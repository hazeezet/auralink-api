import type { FastifyPluginAsync } from "fastify";
import { ErrorCodes } from "#types/response";
import type { CreateOrderInput, Order, OrderItem, TimelineEvent } from "#types/order";
import { config } from "#src/config/index";
import {
    cancelOrderSchema,
    createOrderSchema,
    getOrderSchema,
    getOrderByRefSchema,
    listOrdersSchema,
    simulatePaymentSchema,
} from "./schema";

const uid = () => Math.random().toString(36).slice(2, 9);

const ordersRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
    /**
     * POST /v1/orders - Create Order Link
     */
    fastify.post<{ Body: CreateOrderInput }>(
        "/",
        { schema: createOrderSchema },
        async (request, reply) => {
            const { customer, channel, items: requestedItems, discount: reqDiscount, handle, city, note } = request.body;

            if (!customer?.trim()) {
                reply.status(400);
                reply.response.status_code = 400;
                reply.response.error = ErrorCodes.BAD_REQUEST;
                reply.response.message = "Add the customer name so the ledger can match the payment.";
                return reply.send(reply.response);
            }

            if (!requestedItems || requestedItems.length === 0) {
                reply.status(400);
                reply.response.status_code = 400;
                reply.response.error = ErrorCodes.BAD_REQUEST;
                reply.response.message = "Pick at least one product before creating the link.";
                return reply.send(reply.response);
            }

            // 1. Verify inventory from database
            const productIds = requestedItems.map((i) => i.productId);
            const dbProducts = await fastify.db.products.findByIds(productIds);

            for (const item of requestedItems) {
                const p = dbProducts.find((x) => x.id === item.productId);
                if (!p) {
                    reply.status(404);
                    reply.response.status_code = 404;
                    reply.response.error = ErrorCodes.NOT_FOUND;
                    reply.response.message = `Product ${item.productId} not found in catalogue.`;
                    return reply.send(reply.response);
                }
                if (p.stock < item.qty) {
                    reply.status(400);
                    reply.response.status_code = 400;
                    reply.response.error = ErrorCodes.BAD_REQUEST;
                    reply.response.message = `Only ${p.stock} of "${p.name}" left in stock. Reduce the quantity.`;
                    return reply.send(reply.response);
                }
            }

            // 2. Map items and calculate totals
            const items: OrderItem[] = requestedItems.map((i) => {
                const p = dbProducts.find((x) => x.id === i.productId)!;
                return {
                    productId: p.id,
                    name: p.name,
                    qty: i.qty,
                    unitPrice: p.price,
                    emoji: p.emoji,
                };
            });

            const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
            const discount = Math.min(reqDiscount ?? 0, subtotal);
            const total = subtotal - discount;

            const orderId = `ORD-${Math.floor(2000 + Math.random() * 7000)}`;
            const now = new Date();
            const expiresAt = new Date(now.getTime() + config.rates.quoteMinutes * 60_000).toISOString();

            // 3. Request payment link from Busha Sandbox
            let bushaRef = `BUSHA-${Math.floor(100000 + Math.random() * 899999)}`;
            try {
                const bushaRes = await fastify.busha.createPaymentLink({
                    title: `Amaka Threads - ${orderId}`,
                    description: items.map((i) => `${i.qty}x ${i.name}`).join(", "),
                    amount: total,
                    currency: channel === "USDC" ? "USDC" : "NGN",
                    expires_in: config.rates.quoteMinutes * 60,
                    metadata: {
                        order_id: orderId,
                        customer: customer.trim(),
                        channel,
                    },
                });
                if (bushaRes) {
                    bushaRef = bushaRes.reference || bushaRes.id || bushaRef;
                }
            } catch (err) {
                fastify.log.warn(`Busha link creation failed, using sandbox ref: ${err instanceof Error ? err.message : String(err)}`);
            }

            const timeline: TimelineEvent[] = [
                {
                    id: uid(),
                    label: "Order created",
                    note: "One-time link generated for this order only via Busha",
                    at: now.toISOString(),
                    tone: "neutral",
                },
            ];

            const newOrder: Order = {
                id: orderId,
                customer: customer.trim(),
                handle: handle?.trim() || `@${customer.trim().split(" ")[0].toLowerCase()}`,
                city: city?.trim() || (channel === "USDC" ? "International" : "Nigeria"),
                channel,
                items,
                subtotal,
                discount,
                total,
                status: "awaiting",
                ref: bushaRef,
                expiresAt,
                createdAt: now.toISOString(),
                note: note?.trim() || undefined,
                timeline,
            };

            // 4. Save order to Supabase and decrement stock
            const savedOrder = await fastify.db.orders.create(newOrder);
            await fastify.db.products.decrementStock(requestedItems);

            reply.status(201);
            reply.response.status_code = 201;
            reply.response.message = "Order created successfully";
            reply.response.data = savedOrder;
            return reply.send(reply.response);
        },
    );

    /**
     * GET /v1/orders - List Orders
     */
    fastify.get<{ Querystring: { status?: string; q?: string } }>(
        "/",
        { schema: listOrdersSchema },
        async (request, reply) => {
            const list = await fastify.db.orders.list(request.query.status, request.query.q);
            reply.response.message = "Orders retrieved successfully";
            reply.response.data = list;
            return reply.send(reply.response);
        },
    );

    /**
     * GET /v1/orders/:id - Get Order by ID
     */
    fastify.get<{ Params: { id: string } }>(
        "/:id",
        { schema: getOrderSchema },
        async (request, reply) => {
            const order = await fastify.db.orders.findById(request.params.id);
            if (!order) {
                reply.status(404);
                reply.response.status_code = 404;
                reply.response.error = ErrorCodes.NOT_FOUND;
                reply.response.message = `Order ${request.params.id} not found`;
                return reply.send(reply.response);
            }

            reply.response.message = "Order retrieved";
            reply.response.data = order;
            return reply.send(reply.response);
        },
    );

    /**
     * GET /v1/orders/ref/:ref - Get Order by Busha Ref
     */
    fastify.get<{ Params: { ref: string } }>(
        "/ref/:ref",
        { schema: getOrderByRefSchema },
        async (request, reply) => {
            const order = await fastify.db.orders.findByRef(request.params.ref);
            if (!order) {
                reply.status(404);
                reply.response.status_code = 404;
                reply.response.error = ErrorCodes.NOT_FOUND;
                reply.response.message = `Order with ref ${request.params.ref} not found`;
                return reply.send(reply.response);
            }

            reply.response.message = "Order retrieved";
            reply.response.data = order;
            return reply.send(reply.response);
        },
    );

    /**
     * POST /v1/orders/:id/cancel - Cancel Order
     */
    fastify.post<{ Params: { id: string } }>(
        "/:id/cancel",
        { schema: cancelOrderSchema },
        async (request, reply) => {
            const cancelled = await fastify.db.orders.cancel(request.params.id);
            if (!cancelled) {
                reply.status(404);
                reply.response.status_code = 404;
                reply.response.error = ErrorCodes.NOT_FOUND;
                reply.response.message = `Order ${request.params.id} not found`;
                return reply.send(reply.response);
            }

            reply.response.message = "Order cancelled";
            reply.response.data = cancelled;
            return reply.send(reply.response);
        },
    );

    /**
     * POST /v1/orders/:id/simulate - Demo Payment Simulation
     */
    fastify.post<{ Params: { id: string }; Body?: { amountNgn?: number } }>(
        "/:id/simulate",
        { schema: simulatePaymentSchema },
        async (request, reply) => {
            const order = await fastify.db.orders.findById(request.params.id);
            if (!order) {
                reply.status(404);
                reply.response.status_code = 404;
                reply.response.error = ErrorCodes.NOT_FOUND;
                reply.response.message = `Order ${request.params.id} not found`;
                return reply.send(reply.response);
            }

            const amountNgn = request.body?.amountNgn ?? order.total;
            const isUsdc = order.channel === "USDC";
            const amountReceived = isUsdc ? +(amountNgn / config.rates.usdcNgn).toFixed(2) : amountNgn;

            const fee = Math.round(amountNgn * (config.rates.feePercent / 100));
            const net = Math.round(amountNgn - fee);
            const toleranceThreshold = order.total * (1 - config.rates.underpayTolerancePercent / 100);
            const isShort = amountNgn < toleranceThreshold;
            const now = Date.now();
            const isLate = order.status === "expired" || new Date(order.expiresAt).getTime() < now;

            const status = isShort ? "underpaid" : isLate ? "late_paid" : "paid";
            const stamp = new Date().toISOString();
            const eventId = `sim_evt_${Date.now()}_${uid()}`;

            const note = isShort
                ? `₦${(order.total - amountNgn).toLocaleString("en-NG")} still outstanding. Ask for balance or refund.`
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

            // 1. Audit in payments table
            await fastify.db.payments.create({
                orderId: order.id,
                bushaEventId: eventId,
                amountReceived,
                currency: order.channel,
                network: isUsdc ? "Base" : "NIBSS Instant Transfer",
                nairaValue: amountNgn,
                fee,
                rawPayload: { simulation: true, simulated_at: stamp },
            });

            // 2. Inscribe in ledger table
            await fastify.db.ledger.create({
                id: uid(),
                orderId: order.id,
                customer: order.customer,
                amountReceived,
                currency: order.channel,
                nairaValue: amountNgn,
                fee,
                net,
                status: isShort ? "flagged" : "settled",
                bushaEventId: eventId,
                createdAt: stamp,
            });

            // 3. Credit balances
            await fastify.db.balances.creditNgn(net);

            // 4. Update order state
            const updatedOrder = await fastify.db.orders.updateStatus(
                order.id,
                status,
                stamp,
                amountNgn,
                note,
                timelineEvent,
            );

            reply.response.message = "Payment simulated successfully";
            reply.response.data = updatedOrder;
            return reply.send(reply.response);
        },
    );
};

export default ordersRoutes;
