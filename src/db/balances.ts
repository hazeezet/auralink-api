import type { SupabaseClient } from "@supabase/supabase-js";
import type { Balances } from "#types/ledger";

export interface BalanceDB {
    get(): Promise<Balances>;
    update(ngn: number, usdc: number): Promise<Balances>;
    creditNgn(amount: number): Promise<Balances>;
    debitNgn(amount: number): Promise<Balances>;
    convert(ngnAmount: number, usdcAmount: number): Promise<Balances>;
}

export function createBalanceDB(supabase: SupabaseClient): BalanceDB {
    return {
        async get(): Promise<Balances> {
            const { data, error } = await supabase
                .from("balances")
                .select("ngn, usdc")
                .eq("id", "amaka")
                .maybeSingle();

            if (error) {
                throw new Error(`Failed to fetch balances: ${error.message}`);
            }

            return {
                ngn: Number(data?.ngn ?? 842500),
                usdc: Number(data?.usdc ?? 620),
            };
        },

        async update(ngn: number, usdc: number): Promise<Balances> {
            const { data, error } = await supabase
                .from("balances")
                .upsert({ id: "amaka", ngn, usdc, updated_at: new Date().toISOString() })
                .select("ngn, usdc")
                .single();

            if (error || !data) {
                throw new Error(`Failed to update balances: ${error?.message || "Unknown"}`);
            }

            return {
                ngn: Number(data.ngn),
                usdc: Number(data.usdc),
            };
        },

        async creditNgn(amount: number): Promise<Balances> {
            const current = await this.get();
            const newNgn = current.ngn + amount;
            return this.update(newNgn, current.usdc);
        },

        async debitNgn(amount: number): Promise<Balances> {
            const current = await this.get();
            if (amount > current.ngn) {
                throw new Error(`Insufficient funds: requested ₦${amount}, current balance ₦${current.ngn}`);
            }
            const newNgn = current.ngn - amount;
            return this.update(newNgn, current.usdc);
        },

        async convert(ngnAmount: number, usdcAmount: number): Promise<Balances> {
            const current = await this.get();
            if (ngnAmount > current.ngn) {
                throw new Error(`Insufficient funds: requested ₦${ngnAmount}, current balance ₦${current.ngn}`);
            }
            const newNgn = current.ngn - ngnAmount;
            const newUsdc = current.usdc + usdcAmount;
            return this.update(newNgn, newUsdc);
        },
    };
}
