import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrderDB, type OrderDB } from "./orders";
import { createPaymentDB, type PaymentDB } from "./payments";
import { createLedgerDB, type LedgerDB } from "./ledger";
import { createBalanceDB, type BalanceDB } from "./balances";
import { createProductDB, type ProductDB } from "./products";

export { type OrderDB } from "./orders";
export { type PaymentDB } from "./payments";
export { type LedgerDB } from "./ledger";
export { type BalanceDB } from "./balances";
export { type ProductDB } from "./products";

export interface DatabaseContext {
    orders: OrderDB;
    payments: PaymentDB;
    ledger: LedgerDB;
    balances: BalanceDB;
    products: ProductDB;
}

export function createDatabaseContext(supabase: SupabaseClient): DatabaseContext {
    return {
        orders: createOrderDB(supabase),
        payments: createPaymentDB(supabase),
        ledger: createLedgerDB(supabase),
        balances: createBalanceDB(supabase),
        products: createProductDB(supabase),
    };
}

