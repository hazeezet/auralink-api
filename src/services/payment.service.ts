import { getSupabase } from "../lib/supabase";
import { config } from "../config";
import { appLogger } from "../lib/logger";
import { orderService } from "./order.service";
import type { BushaWebhookPayload } from "../types/busha";
import type { Order, TimelineEvent } from "../types/order";
import type { LedgerEntry } from "../types/ledger";

const uid = () => Math.random().toString(36).slice(2, 9);

export interface ProcessPaymentParams {
    orderId?: string;
    ref?: string;
    bushaEventId: string;
    amountReceived: number;
    currency: "NGN" | "USDC" | string;
    network?: string;
    rawPayload: Record<string, unknown>;
}

export class PaymentService {
    /**
     * Processes an inbound payment from Busha webhook or demo simulation.
     * Enforces strict idempotency and deterministic state machine rules.
     */
    async processPayment(params: ProcessPaymentParams): Promise<{ order: Order | null; ledger: LedgerEntry | null; duplicate: boolean }> {
        const supabase = getSupabase();

        // 1. Idempotency Check
        const { data: existingPayment } = await supabase
            .from("payments")
            .select("id")
            .eq("busha_event_id", params.bushaEventId)
            .maybeSingle();

        if (existingPayment) {
            appLogger.info(`[Idempotency Guard] Ignoring duplicate payment event: ${params.bushaEventId}`);
            return { order: null, ledger: null, duplicate: true };
        }

        // 2. Find Order
        let order: Order | null = null;
        if (params.orderId) {
            order = await orderService.getOrderById(params.orderId);
        } else if (params.ref) {
            order = await orderService.getOrderByRef(params.ref);
        }

        if (!order) {
            appLogger.warn(`[Payment] Unmatched payment received for ref: ${params.ref}, event: ${params.bushaEventId}`);
            // Still log to payments table as unmatched for audit
            await supabase.from("payments").insert({
                busha_event_id: params.bushaEventId,
                amount_received: params.amountReceived,
                currency: params.currency,
                network: params.network || "unknown",
                naira_value: params.currency === "USDC" ? params.amountReceived * config.rates.usdcNgn : params.amountReceived,
                fee: 0,
                raw_payload: params.rawPayload,
            });
            return { order: null, ledger: null, duplicate: false };
        }

        // 3. Determine Naira Value & Tolerances
        const nairaValue = params.currency === "USDC"
            ? params.amountReceived * config.rates.usdcNgn
            : params.amountReceived;

        const toleranceThreshold = order.total * (1 - config.rates.underpayTolerancePercent / 100);
        const isShort = nairaValue < toleranceThreshold;
        const now = Date.now();
        const isLate = order.status === "expired" || new Date(order.expiresAt).getTime() < now;

        let status: Order["status"];
        if (isShort) {
            status = "underpaid";
        } else if (isLate) {
            status = "late_paid";
        } else {
            status = "paid";
        }

        // 4. Calculate Fee and Net Settlement
        const fee = Math.round(nairaValue * (config.rates.feePercent / 100));
        const net = Math.round(nairaValue - fee);
        const stamp = new Date().toISOString();

        const note = isShort
            ? `₦${(order.total - nairaValue).toLocaleString("en-NG")} still outstanding. Ask for balance or refund.`
            : isLate
                ? "Money arrived after the quote expired. Confirm the price with the buyer."
                : undefined;

        const timelineTone = isShort ? "warn" : "good";
        const timelineNote = order.channel === "USDC"
            ? `${(nairaValue / config.rates.usdcNgn).toFixed(2)} USDC on Base/Polygon · settled to ₦${net.toLocaleString("en-NG")} after fee`
            : `Naira transfer · settled to ₦${net.toLocaleString("en-NG")} after fee`;

        const newTimeline: TimelineEvent = {
            id: uid(),
            label: isShort ? "Short payment received" : "Payment received",
            note: timelineNote,
            at: stamp,
            tone: timelineTone,
        };

        // 5. Insert Payment Audit Record
        await supabase.from("payments").insert({
            order_id: order.id,
            busha_event_id: params.bushaEventId,
            amount_received: params.amountReceived,
            currency: params.currency,
            network: params.network || (params.currency === "USDC" ? "Base" : "NIBSS"),
            naira_value: nairaValue,
            fee,
            raw_payload: params.rawPayload,
        });

        // 6. Insert Ledger Entry
        const ledgerId = uid();
        const { error: ledgerErr } = await supabase.from("ledger").insert({
            id: ledgerId,
            order_id: order.id,
            customer: order.customer,
            amount_received: params.amountReceived,
            currency: order.channel,
            naira_value: nairaValue,
            fee,
            net,
            status: isShort ? "flagged" : "settled",
            busha_event_id: params.bushaEventId,
            created_at: stamp,
        });

        if (ledgerErr) {
            appLogger.error("Failed to insert ledger entry", ledgerErr);
        }

        // 7. Update Balances (Default 80/20 split or full settlement)
        const { data: balanceData } = await supabase
            .from("balances")
            .select("*")
            .eq("id", "amaka")
            .maybeSingle();

        const currentNgn = Number(balanceData?.ngn || 0);
        await supabase
            .from("balances")
            .update({
                ngn: currentNgn + net,
                updated_at: stamp,
            })
            .eq("id", "amaka");

        // 8. Update Order in Supabase
        const updatedOrder: Order = {
            ...order,
            status,
            paidAt: stamp,
            receivedNgn: nairaValue,
            note,
            timeline: [...order.timeline, newTimeline],
        };

        await supabase
            .from("orders")
            .update({
                status: updatedOrder.status,
                paid_at: updatedOrder.paidAt,
                received_ngn: updatedOrder.receivedNgn,
                note: updatedOrder.note,
                timeline: updatedOrder.timeline,
            })
            .eq("id", order.id);

        const ledgerEntry: LedgerEntry = {
            id: ledgerId,
            orderId: order.id,
            customer: order.customer,
            amountReceived: params.amountReceived,
            currency: order.channel,
            nairaValue,
            fee,
            net,
            status: isShort ? "flagged" : "settled",
            createdAt: stamp,
            bushaEventId: params.bushaEventId,
        };

        return { order: updatedOrder, ledger: ledgerEntry, duplicate: false };
    }

    /**
     * Webhook adapter for Busha inbound events.
     */
    async handleBushaWebhook(payload: BushaWebhookPayload): Promise<void> {
        const orderId = payload.data.metadata?.order_id;
        const ref = payload.data.reference;
        const amountReceived = Number(payload.data.amount_received || payload.data.naira_value || 0);
        const currency = (payload.data.currency as "NGN" | "USDC") || "NGN";

        await this.processPayment({
            orderId,
            ref,
            bushaEventId: payload.event_id,
            amountReceived,
            currency,
            network: payload.data.network,
            rawPayload: payload as unknown as Record<string, unknown>,
        });
    }

    /**
     * Demo simulation trigger (Stand-in when presenting or in offline judging).
     */
    async simulatePayment(orderId: string, customAmountNgn?: number): Promise<Order> {
        const order = await orderService.getOrderById(orderId);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        const amountNgn = customAmountNgn ?? order.total;
        const isUsdc = order.channel === "USDC";
        const amountReceived = isUsdc ? +(amountNgn / config.rates.usdcNgn).toFixed(2) : amountNgn;

        const fakeEventId = `sim_evt_${Date.now()}_${uid()}`;

        const result = await this.processPayment({
            orderId: order.id,
            bushaEventId: fakeEventId,
            amountReceived,
            currency: order.channel,
            network: isUsdc ? "Base" : "NIBSS Instant Transfer",
            rawPayload: {
                simulation: true,
                simulated_at: new Date().toISOString(),
                order_id: order.id,
                amount_ngn: amountNgn,
            },
        });

        return result.order!;
    }
}

export const paymentService = new PaymentService();
