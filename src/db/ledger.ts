import type { SupabaseClient } from "@supabase/supabase-js";
import type { LedgerEntry } from "#types/ledger";

export interface LedgerDB {
    create(entry: LedgerEntry): Promise<LedgerEntry>;
    list(status?: string): Promise<LedgerEntry[]>;
}

export function createLedgerDB(supabase: SupabaseClient): LedgerDB {
    return {
        async create(entry: LedgerEntry): Promise<LedgerEntry> {
            const { error } = await supabase.from("ledger").insert({
                id: entry.id,
                order_id: entry.orderId || null,
                customer: entry.customer,
                amount_received: entry.amountReceived,
                currency: entry.currency,
                naira_value: entry.nairaValue,
                fee: entry.fee,
                net: entry.net,
                status: entry.status,
                busha_event_id: entry.bushaEventId,
                created_at: entry.createdAt,
            });

            if (error) {
                throw new Error(`Failed to insert ledger entry: ${error.message}`);
            }

            return entry;
        },

        async list(status?: string): Promise<LedgerEntry[]> {
            let qb = supabase.from("ledger").select("*").order("created_at", { ascending: false });

            if (status && status !== "all") {
                qb = qb.eq("status", status);
            }

            const { data, error } = await qb;
            if (error) {
                throw new Error(`Failed to list ledger: ${error.message}`);
            }

            return (data || []).map((row) => ({
                id: String(row.id),
                orderId: row.order_id ? String(row.order_id) : null,
                customer: String(row.customer),
                amountReceived: Number(row.amount_received),
                currency: (row.currency as "NGN" | "USDC") || "NGN",
                nairaValue: Number(row.naira_value),
                fee: Number(row.fee),
                net: Number(row.net),
                status: row.status as LedgerEntry["status"],
                createdAt: String(row.created_at),
                bushaEventId: String(row.busha_event_id),
            }));
        },
    };
}
