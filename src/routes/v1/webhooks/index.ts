import type { FastifyPluginAsync } from "fastify";
import { ErrorCodes } from "#types/response";
import type { BushaWebhookPayload } from "#types/busha";
import type { TimelineEvent } from "#types/order";
import { config } from "#src/config/index";
import { bushaWebhookSchema } from "./schema";

const uid = () => Math.random().toString(36).slice(2, 9);

const webhooksRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
    /**
     * POST /v1/webhooks/busha - Busha Payment Webhook
     */
    fastify.post<{ Body: BushaWebhookPayload }>(
        "/busha",
        { schema: bushaWebhookSchema },
        async (request, reply) => {
            const rawSignature = (request.headers["x-bu-signature"] || request.headers["x-busha-signature"]) as string | undefined;

            // 1. Signature Verification
            const rawBody = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
            const isValid = fastify.busha.verifyWebhookSignature(rawBody, rawSignature);

            if (!isValid && process.env.NODE_ENV === "production") {
                reply.status(401);
                reply.response.status_code = 401;
                reply.response.error = ErrorCodes.UNAUTHORIZED;
                reply.response.message = "Invalid Busha webhook signature";
                return reply.send(reply.response);
            }

            const payload = request.body;

            // 2. Idempotency Check
            const existing = await fastify.db.payments.findByEventId(payload.event_id);
            if (existing) {
                fastify.log.info(`[Webhook Idempotency] Ignoring repeat delivery: ${payload.event_id}`);
                reply.response.message = "Webhook already processed";
                reply.response.data = { processed: true, event_id: payload.event_id };
                return reply.send(reply.response);
            }

            // 3. Match Order
            const orderId = payload.data?.metadata?.order_id as string | undefined;
            const ref = (payload.data?.reference || payload.data?.id) as string;

            const order = orderId
                ? await fastify.db.orders.findById(orderId)
                : await fastify.db.orders.findByRef(ref);

            // Handle cancellation / expiration events from Busha
            if (payload.event === "payment_request.cancelled" || payload.event === "charge.cancelled") {
                if (order && order.status === "awaiting") {
                    await fastify.db.orders.cancel(order.id);
                }
                reply.response.message = "Order cancelled via webhook";
                reply.response.data = { processed: true, event_id: payload.event_id };
                return reply.send(reply.response);
            }

            if (payload.event === "payment_request.expired" || payload.event === "charge.expired") {
                if (order && order.status === "awaiting") {
                    await fastify.db.orders.expire(order.id);
                }
                reply.response.message = "Order expired via webhook";
                reply.response.data = { processed: true, event_id: payload.event_id };
                return reply.send(reply.response);
            }

            // Resolve amount received (supports multiple Busha payload schemas)
            const rawData = payload.data as Record<string, unknown>;
            const rawAmount = payload.data.amount_received ?? rawData.paid_amount ?? rawData.amount ?? 0;
            const amountReceived = Number(rawAmount);
            const currency = payload.data.currency || order?.channel || "NGN";
            const nairaValue = Number(payload.data.naira_value || (currency === "USDC" ? amountReceived * config.rates.usdcNgn : amountReceived));
            const fee = Number(payload.data.fee || Math.round(nairaValue * (config.rates.feePercent / 100)));
            const net = Math.round(nairaValue - fee);

            // Record in payments table (even if unmatched for audit log)
            await fastify.db.payments.create({
                orderId: order?.id || null,
                bushaEventId: payload.event_id,
                amountReceived,
                currency,
                network: payload.data.network || "unknown",
                nairaValue,
                fee,
                rawPayload: payload as unknown as Record<string, unknown>,
            });

            if (!order) {
                fastify.log.warn(`[Webhook Unmatched] No order found for reference: ${ref}, event: ${payload.event_id}`);
                reply.response.message = "Payment recorded but order was unmatched";
                reply.response.data = { processed: true, event_id: payload.event_id };
                return reply.send(reply.response);
            }

            // 4. State Machine Evaluation
            const toleranceThreshold = order.total * (1 - config.rates.underpayTolerancePercent / 100);
            const isShort = nairaValue < toleranceThreshold;
            const now = Date.now();
            const isLate = order.status === "expired" || new Date(order.expiresAt).getTime() < now;

            const status = isShort ? "underpaid" : isLate ? "late_paid" : "paid";
            const stamp = new Date().toISOString();

            const note = isShort
                ? `₦${(order.total - nairaValue).toLocaleString("en-NG")} still outstanding. Ask for balance or refund.`
                : isLate
                    ? "Money arrived after the quote expired. Confirm the price with the buyer."
                    : undefined;

            const timelineNote = order.channel === "USDC"
                ? `${amountReceived} USDC on Base/Polygon · settled to ₦${net.toLocaleString("en-NG")} after fee`
                : `Naira transfer · settled to ₦${net.toLocaleString("en-NG")} after fee`;

            const timelineEvent: TimelineEvent = {
                id: uid(),
                label: isShort ? "Short payment received" : "Payment received",
                note: timelineNote,
                at: stamp,
                tone: isShort ? "warn" : "good",
            };

            // 5. Inscribe into Ledger
            await fastify.db.ledger.create({
                id: uid(),
                orderId: order.id,
                customer: order.customer,
                amountReceived,
                currency: order.channel,
                nairaValue,
                fee,
                net,
                status: isShort ? "flagged" : "settled",
                bushaEventId: payload.event_id,
                createdAt: stamp,
            });

            // 6. Credit Balances
            await fastify.db.balances.creditNgn(net);

            // 7. Update Order
            await fastify.db.orders.updateStatus(
                order.id,
                status,
                stamp,
                nairaValue,
                note,
                timelineEvent,
            );

            reply.response.message = "Webhook processed successfully";
            reply.response.data = { processed: true, event_id: payload.event_id };
            return reply.send(reply.response);
        },
    );
};

export default webhooksRoutes;
