import { getSupabase } from "../lib/supabase";
import { bushaClient } from "../lib/busha";
import { config } from "../config";
import { appLogger } from "../lib/logger";
import type { LedgerEntry, Balances, PayoutInput, ConvertInput } from "../types/ledger";

export class LedgerService {
    /**
     * Lists ledger entries with optional status filtering.
     */
    async listLedger(status?: string): Promise<LedgerEntry[]> {
        const supabase = getSupabase();
        let qb = supabase.from("ledger").select("*").order("created_at", { ascending: false });

        if (status && status !== "all") {
            qb = qb.eq("status", status);
        }

        const { data, error } = await qb;
        if (error) {
            appLogger.error("Failed to list ledger from Supabase", error);
            throw new Error(`Database error fetching ledger: ${error.message}`);
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
    }

    /**
     * Fetches current balances for Amaka.
     */
    async getBalances(): Promise<Balances> {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("balances")
            .select("ngn, usdc")
            .eq("id", "amaka")
            .maybeSingle();

        if (error) {
            appLogger.error("Failed to fetch balances from Supabase", error);
            throw new Error(`Database error fetching balances: ${error.message}`);
        }

        return {
            ngn: Number(data?.ngn || 0),
            usdc: Number(data?.usdc || 0),
        };
    }

    /**
     * Initiates a withdrawal / payout to Amaka's Nigerian bank account using Busha Quotes.
     */
    async withdraw(input: PayoutInput): Promise<{ success: boolean; newBalances: Balances; quoteId?: string }> {
        const supabase = getSupabase();
        const balances = await this.getBalances();

        if (input.amount <= 0) {
            throw new Error("Withdrawal amount must be greater than zero.");
        }
        if (input.amount < 100) {
            throw new Error("Minimum withdrawal is ₦100.");
        }
        if (input.amount > balances.ngn) {
            throw new Error(`Insufficient balance. Current balance is ₦${balances.ngn.toLocaleString("en-NG")}.`);
        }

        // Call Busha quotes API for withdrawal quote
        let quoteId: string | undefined;
        try {
            const quote = await bushaClient.createQuote({
                source_currency: "NGN",
                target_currency: "NGN",
                source_amount: input.amount,
                type: "withdrawal",
            });
            quoteId = quote.id;
        } catch (err) {
            appLogger.warn("Busha withdrawal quote failed, falling back to local ledger update", err);
        }

        const newNgn = balances.ngn - input.amount;
        await supabase
            .from("balances")
            .update({ ngn: newNgn, updated_at: new Date().toISOString() })
            .eq("id", "amaka");

        return {
            success: true,
            newBalances: { ngn: newNgn, usdc: balances.usdc },
            quoteId,
        };
    }

    /**
     * Converts NGN to USDC using Busha Quotes API (Amaka's Restock Vault hedge).
     */
    async convert(input: ConvertInput): Promise<{ success: boolean; newBalances: Balances; usdcGained: number }> {
        const supabase = getSupabase();
        const balances = await this.getBalances();

        if (input.amountNgn <= 0 || input.amountNgn > balances.ngn) {
            throw new Error("Invalid conversion amount.");
        }

        // Request conversion quote from Busha
        let usdcGained = +(input.amountNgn / config.rates.usdcNgn).toFixed(2);
        try {
            const quote = await bushaClient.createQuote({
                source_currency: "NGN",
                target_currency: "USDC",
                source_amount: input.amountNgn,
            });
            if (quote.target_amount) {
                usdcGained = quote.target_amount;
            }
        } catch (err) {
            appLogger.warn("Busha quote API call failed, using fixed rate", err);
        }

        const newNgn = balances.ngn - input.amountNgn;
        const newUsdc = balances.usdc + usdcGained;

        await supabase
            .from("balances")
            .update({ ngn: newNgn, usdc: newUsdc, updated_at: new Date().toISOString() })
            .eq("id", "amaka");

        return {
            success: true,
            newBalances: { ngn: newNgn, usdc: newUsdc },
            usdcGained,
        };
    }
}

export const ledgerService = new LedgerService();
