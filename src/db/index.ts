import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrderDB, type OrderDB } from "./orders";
import { createPaymentDB, type PaymentDB } from "./payments";
import { createLedgerDB, type LedgerDB } from "./ledger";
import { createBalanceDB, type BalanceDB } from "./balances";
import { createProductDB, type ProductDB } from "./products";
import {
    createMemoryOrderDB,
    createMemoryPaymentDB,
    createMemoryLedgerDB,
    createMemoryBalanceDB,
    createMemoryProductDB,
} from "./memory";
import { appLogger } from "../lib/logger";

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
    const sbOrders = createOrderDB(supabase);
    const sbPayments = createPaymentDB(supabase);
    const sbLedger = createLedgerDB(supabase);
    const sbBalances = createBalanceDB(supabase);
    const sbProducts = createProductDB(supabase);

    const memOrders = createMemoryOrderDB();
    const memPayments = createMemoryPaymentDB();
    const memLedger = createMemoryLedgerDB();
    const memBalances = createMemoryBalanceDB();
    const memProducts = createMemoryProductDB();

    let warned = false;
    const fallback = <T>(fnName: string, err: unknown, fallbackFn: () => Promise<T>): Promise<T> => {
        if (!warned) {
            appLogger.warn(`[Database] Supabase unreachable (${err instanceof Error ? err.message : String(err)}). Using in-memory store fallback.`);
            warned = true;
        }
        return fallbackFn();
    };

    return {
        orders: {
            async create(order) {
                try {
                    const res = await sbOrders.create(order);
                    await memOrders.create(order);
                    return res;
                } catch (err) {
                    return fallback("orders.create", err, () => memOrders.create(order));
                }
            },
            async findById(id) {
                try {
                    const res = await sbOrders.findById(id);
                    if (res) return res;
                    return memOrders.findById(id);
                } catch (err) {
                    return fallback("orders.findById", err, () => memOrders.findById(id));
                }
            },
            async findByRef(ref) {
                try {
                    const res = await sbOrders.findByRef(ref);
                    if (res) return res;
                    return memOrders.findByRef(ref);
                } catch (err) {
                    return fallback("orders.findByRef", err, () => memOrders.findByRef(ref));
                }
            },
            async list(status, query) {
                try {
                    const res = await sbOrders.list(status, query);
                    if (res && res.length > 0) return res;
                    return memOrders.list(status, query);
                } catch (err) {
                    return fallback("orders.list", err, () => memOrders.list(status, query));
                }
            },
            async updateStatus(id, status, paidAt, receivedNgn, note, newTimeline) {
                try {
                    const res = await sbOrders.updateStatus(id, status, paidAt, receivedNgn, note, newTimeline);
                    await memOrders.updateStatus(id, status, paidAt, receivedNgn, note, newTimeline);
                    return res;
                } catch (err) {
                    return fallback("orders.updateStatus", err, () => memOrders.updateStatus(id, status, paidAt, receivedNgn, note, newTimeline));
                }
            },
            async cancel(id) {
                try {
                    const res = await sbOrders.cancel(id);
                    await memOrders.cancel(id);
                    return res;
                } catch (err) {
                    return fallback("orders.cancel", err, () => memOrders.cancel(id));
                }
            },
            async expire(id) {
                try {
                    const res = await sbOrders.expire(id);
                    await memOrders.expire(id);
                    return res;
                } catch (err) {
                    return fallback("orders.expire", err, () => memOrders.expire(id));
                }
            },
        },
        products: {
            async list() {
                try {
                    const res = await sbProducts.list();
                    if (res && res.length > 0) return res;
                    return memProducts.list();
                } catch (err) {
                    return fallback("products.list", err, () => memProducts.list());
                }
            },
            async findByIds(ids) {
                try {
                    const res = await sbProducts.findByIds(ids);
                    if (res && res.length > 0) return res;
                    return memProducts.findByIds(ids);
                } catch (err) {
                    return fallback("products.findByIds", err, () => memProducts.findByIds(ids));
                }
            },
            async decrementStock(items) {
                try {
                    await sbProducts.decrementStock(items);
                    await memProducts.decrementStock(items);
                } catch (err) {
                    await fallback("products.decrementStock", err, () => memProducts.decrementStock(items));
                }
            },
        },
        balances: {
            async get() {
                try {
                    return await sbBalances.get();
                } catch (err) {
                    return fallback("balances.get", err, () => memBalances.get());
                }
            },
            async update(ngn, usdc) {
                try {
                    const res = await sbBalances.update(ngn, usdc);
                    await memBalances.update(ngn, usdc);
                    return res;
                } catch (err) {
                    return fallback("balances.update", err, () => memBalances.update(ngn, usdc));
                }
            },
            async creditNgn(amount) {
                try {
                    const res = await sbBalances.creditNgn(amount);
                    await memBalances.creditNgn(amount);
                    return res;
                } catch (err) {
                    return fallback("balances.creditNgn", err, () => memBalances.creditNgn(amount));
                }
            },
            async debitNgn(amount) {
                try {
                    const res = await sbBalances.debitNgn(amount);
                    await memBalances.debitNgn(amount);
                    return res;
                } catch (err) {
                    return fallback("balances.debitNgn", err, () => memBalances.debitNgn(amount));
                }
            },
            async convert(ngnAmount, usdcAmount) {
                try {
                    const res = await sbBalances.convert(ngnAmount, usdcAmount);
                    await memBalances.convert(ngnAmount, usdcAmount);
                    return res;
                } catch (err) {
                    return fallback("balances.convert", err, () => memBalances.convert(ngnAmount, usdcAmount));
                }
            },
        },
        ledger: {
            async create(entry) {
                try {
                    const res = await sbLedger.create(entry);
                    await memLedger.create(entry);
                    return res;
                } catch (err) {
                    return fallback("ledger.create", err, () => memLedger.create(entry));
                }
            },
            async list(status) {
                try {
                    const res = await sbLedger.list(status);
                    if (res && res.length > 0) return res;
                    return memLedger.list(status);
                } catch (err) {
                    return fallback("ledger.list", err, () => memLedger.list(status));
                }
            },
        },
        payments: {
            async create(payment) {
                try {
                    await sbPayments.create(payment);
                    await memPayments.create(payment);
                } catch (err) {
                    await fallback("payments.create", err, () => memPayments.create(payment));
                }
            },
            async findByEventId(eventId) {
                try {
                    const res = await sbPayments.findByEventId(eventId);
                    if (res) return res;
                    return memPayments.findByEventId(eventId);
                } catch (err) {
                    return fallback("payments.findByEventId", err, () => memPayments.findByEventId(eventId));
                }
            },
        },
    };
}
