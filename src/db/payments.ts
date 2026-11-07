import type { SupabaseClient } from "@supabase/supabase-js";

export interface PaymentRecord {
    id?: string;
    orderId?: string | null;
    bushaEventId: string;
    amountReceived: number;
    currency: string;
    network?: string;
    nairaValue: number;
    fee: number;
    rawPayload: Record<string, unknown>;
    createdAt?: string;
}

export interface PaymentDB {
    create(payment: PaymentRecord): Promise<void>;
    findByEventId(eventId: string): Promise<PaymentRecord | null>;
}

export function createPaymentDB(supabase: SupabaseClient): PaymentDB {
    return {
        async create(payment: PaymentRecord): Promise<void> {
            const { error } = await supabase.from("payments").insert({
                order_id: payment.orderId || null,
                busha_event_id: payment.bushaEventId,
                amount_received: payment.amountReceived,
                currency: payment.currency,
                network: payment.network || "unknown",
                naira_value: payment.nairaValue,
                fee: payment.fee,
                raw_payload: payment.rawPayload,
            });

            if (error) {
                throw new Error(`Failed to insert payment record: ${error.message}`);
            }
        },

        async findByEventId(eventId: string): Promise<PaymentRecord | null> {
            const { data, error } = await supabase
                .from("payments")
                .select("*")
                .eq("busha_event_id", eventId)
                .maybeSingle();

            if (error) {
                throw new Error(`Failed to query payment by eventId: ${error.message}`);
            }
            if (!data) {return null;}

            return {
                id: data.id,
                orderId: data.order_id,
                bushaEventId: data.busha_event_id,
                amountReceived: Number(data.amount_received),
                currency: data.currency,
                network: data.network,
                nairaValue: Number(data.naira_value),
                fee: Number(data.fee),
                rawPayload: data.raw_payload as Record<string, unknown>,
                createdAt: data.created_at,
            };
        },
    };
}
