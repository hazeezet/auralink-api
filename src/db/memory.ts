import type { Order, OrderItem, OrderStatus, Product, TimelineEvent } from "#types/order";
import type { Balances, LedgerEntry } from "#types/ledger";
import type { PaymentRecord } from "./payments";
import type { OrderDB } from "./orders";
import type { ProductDB } from "./products";
import type { BalanceDB } from "./balances";
import type { LedgerDB } from "./ledger";
import type { PaymentDB } from "./payments";

const DEFAULT_PRODUCTS: Product[] = [
    { id: "p1", name: "Adire Wrap Dress", price: 42000, stock: 6, emoji: "👗", sku: "AT-DR-01" },
    { id: "p2", name: "Linen Two-Piece Set", price: 58500, stock: 3, emoji: "🧵", sku: "AT-ST-02" },
    { id: "p3", name: "Ankara Tote Bag", price: 18000, stock: 12, emoji: "👜", sku: "AT-BG-03" },
    { id: "p4", name: "Silk Head Wrap", price: 9500, stock: 20, emoji: "🧣", sku: "AT-HW-04" },
    { id: "p5", name: "Beaded Earrings", price: 7200, stock: 0, emoji: "💎", sku: "AT-JW-05" },
    { id: "p6", name: "Boubou Kaftan", price: 63000, stock: 4, emoji: "🥻", sku: "AT-DR-06" },
];

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const daysAgo = (d: number, h = 10) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - d);
    dt.setHours(h, 30, 0, 0);
    return dt.toISOString();
};

const DEFAULT_ORDERS: Order[] = [
    {
        id: "ORD-2401",
        customer: "Sarah Johnson",
        handle: "@sarahj",
        city: "Manchester, UK",
        channel: "USDC",
        items: [{ productId: "p1", name: "Adire Wrap Dress", qty: 1, unitPrice: 42000, emoji: "👗" }],
        subtotal: 42000,
        discount: 0,
        total: 42000,
        status: "awaiting",
        ref: "BUSHA-918234",
        createdAt: minutesAgo(4),
        expiresAt: new Date(now + 11 * 60_000).toISOString(),
        timeline: [
            {
                id: "tl-2401",
                label: "Order created",
                note: "One-time link generated for this order only via Busha",
                at: minutesAgo(4),
                tone: "neutral",
            },
        ],
    },
    {
        id: "ORD-2402",
        customer: "Adaeze Nwosu",
        handle: "@adaeze.n",
        city: "Ibadan, NG",
        channel: "NGN",
        items: [{ productId: "p3", name: "Ankara Tote Bag", qty: 2, unitPrice: 18000, emoji: "👜" }],
        subtotal: 36000,
        discount: 0,
        total: 36000,
        status: "paid",
        ref: "BUSHA-819201",
        createdAt: minutesAgo(24),
        expiresAt: new Date(now + 15 * 60_000).toISOString(),
        paidAt: minutesAgo(19),
        receivedNgn: 36000,
        timeline: [
            {
                id: "tl-2402-1",
                label: "Order created",
                note: "One-time link generated for this order only via Busha",
                at: minutesAgo(24),
                tone: "neutral",
            },
            {
                id: "tl-2402-2",
                label: "Payment received",
                note: "Naira transfer · settled to ₦35,712 after fee",
                at: minutesAgo(19),
                tone: "good",
            },
        ],
    },
    {
        id: "ORD-2403",
        customer: "Tunde Bakare",
        handle: "@tundeb",
        city: "Lagos, NG",
        channel: "NGN",
        items: [{ productId: "p2", name: "Linen Two-Piece Set", qty: 1, unitPrice: 58500, emoji: "🧵" }],
        subtotal: 58500,
        discount: 0,
        total: 58500,
        status: "underpaid",
        ref: "BUSHA-773821",
        createdAt: minutesAgo(75),
        expiresAt: new Date(now + 15 * 60_000).toISOString(),
        paidAt: minutesAgo(68),
        receivedNgn: 40000,
        note: "₦18,500 still outstanding. Ask for balance or refund.",
        timeline: [
            {
                id: "tl-2403-1",
                label: "Order created",
                note: "One-time link generated for this order only via Busha",
                at: minutesAgo(75),
                tone: "neutral",
            },
            {
                id: "tl-2403-2",
                label: "Short payment received",
                note: "Naira transfer · settled to ₦39,680 after fee",
                at: minutesAgo(68),
                tone: "warn",
            },
        ],
    },
    {
        id: "ORD-2399",
        customer: "Chiamaka Eze",
        handle: "@chiamaka_e",
        city: "Enugu, NG",
        channel: "NGN",
        items: [{ productId: "p6", name: "Boubou Kaftan", qty: 1, unitPrice: 63000, emoji: "🥻" }],
        subtotal: 63000,
        discount: 0,
        total: 63000,
        status: "paid",
        ref: "BUSHA-662910",
        createdAt: daysAgo(1, 14),
        expiresAt: new Date(now + 15 * 60_000).toISOString(),
        paidAt: daysAgo(1, 14),
        receivedNgn: 63000,
        timeline: [
            {
                id: "tl-2399",
                label: "Payment received",
                note: "Naira transfer · settled to ₦62,496 after fee",
                at: daysAgo(1, 14),
                tone: "good",
            },
        ],
    },
    {
        id: "ORD-2398",
        customer: "Olivia Bennett",
        handle: "@olivb",
        city: "London, UK",
        channel: "USDC",
        items: [{ productId: "p1", name: "Adire Wrap Dress", qty: 2, unitPrice: 42000, emoji: "👗" }],
        subtotal: 84000,
        discount: 4000,
        total: 80000,
        status: "paid",
        ref: "BUSHA-551829",
        createdAt: daysAgo(2, 11),
        expiresAt: new Date(now + 15 * 60_000).toISOString(),
        paidAt: daysAgo(2, 11),
        receivedNgn: 80000,
        timeline: [
            {
                id: "tl-2398",
                label: "Payment received",
                note: "49.52 USDC on Polygon · settled to ₦79,360 after fee",
                at: daysAgo(2, 11),
                tone: "good",
            },
        ],
    },
];

const DEFAULT_LEDGER: LedgerEntry[] = [
    {
        id: "LED-7101",
        orderId: "ORD-2402",
        customer: "Adaeze Nwosu",
        amountReceived: 36000,
        currency: "NGN",
        nairaValue: 36000,
        fee: 288,
        net: 35712,
        status: "settled",
        createdAt: minutesAgo(19),
        bushaEventId: "evt_m4a1b2",
    },
    {
        id: "LED-7102",
        orderId: "ORD-2403",
        customer: "Tunde Bakare",
        amountReceived: 40000,
        currency: "NGN",
        nairaValue: 40000,
        fee: 320,
        net: 39680,
        status: "flagged",
        createdAt: minutesAgo(68),
        bushaEventId: "evt_m3c9f1",
    },
    {
        id: "LED-7098",
        orderId: "ORD-2399",
        customer: "Chiamaka Eze",
        amountReceived: 63000,
        currency: "NGN",
        nairaValue: 63000,
        fee: 504,
        net: 62496,
        status: "settled",
        createdAt: daysAgo(1, 14),
        bushaEventId: "evt_m2p4x8",
    },
    {
        id: "LED-7097",
        orderId: "ORD-2398",
        customer: "Olivia Bennett",
        amountReceived: 49.52,
        currency: "USDC",
        nairaValue: 80000,
        fee: 640,
        net: 79360,
        status: "settled",
        createdAt: daysAgo(2, 11),
        bushaEventId: "evt_m1k7w2",
    },
];

let inMemoryProducts = [...DEFAULT_PRODUCTS];
let inMemoryOrders = [...DEFAULT_ORDERS];
let inMemoryLedger = [...DEFAULT_LEDGER];
let inMemoryPayments: PaymentRecord[] = [];
let inMemoryBalances: Balances = {
    ngn: 842500,
    usdc: 620,
};

export function createMemoryOrderDB(): OrderDB {
    return {
        async create(order: Order): Promise<Order> {
            inMemoryOrders.unshift(order);
            return order;
        },
        async findById(id: string): Promise<Order | null> {
            return inMemoryOrders.find((o) => o.id === id) || null;
        },
        async findByRef(ref: string): Promise<Order | null> {
            return inMemoryOrders.find((o) => o.ref === ref) || null;
        },
        async list(status?: string, query?: string): Promise<Order[]> {
            let res = [...inMemoryOrders];
            if (status && status !== "all") {
                res = res.filter((o) => o.status === status);
            }
            if (query && query.trim()) {
                const q = query.trim().toLowerCase();
                res = res.filter(
                    (o) =>
                        o.id.toLowerCase().includes(q) ||
                        o.customer.toLowerCase().includes(q) ||
                        o.ref.toLowerCase().includes(q) ||
                        o.city.toLowerCase().includes(q),
                );
            }
            return res;
        },
        async updateStatus(
            id: string,
            status: OrderStatus,
            paidAt?: string,
            receivedNgn?: number,
            note?: string,
            newTimeline?: TimelineEvent,
        ): Promise<Order | null> {
            const idx = inMemoryOrders.findIndex((o) => o.id === id);
            if (idx === -1) return null;
            const existing = inMemoryOrders[idx];
            const updated: Order = {
                ...existing,
                status,
                paidAt: paidAt ?? existing.paidAt,
                receivedNgn: receivedNgn ?? existing.receivedNgn,
                note: note ?? existing.note,
                timeline: newTimeline ? [...existing.timeline, newTimeline] : existing.timeline,
            };
            inMemoryOrders[idx] = updated;
            return updated;
        },
        async cancel(id: string): Promise<Order | null> {
            return this.updateStatus(id, "cancelled");
        },
        async expire(id: string): Promise<Order | null> {
            return this.updateStatus(id, "expired");
        },
    };
}

export function createMemoryProductDB(): ProductDB {
    return {
        async list(): Promise<Product[]> {
            return [...inMemoryProducts];
        },
        async findByIds(ids: string[]): Promise<Product[]> {
            return inMemoryProducts.filter((p) => ids.includes(p.id));
        },
        async decrementStock(items: { productId: string; qty: number }[]): Promise<void> {
            for (const item of items) {
                const p = inMemoryProducts.find((x) => x.id === item.productId);
                if (p) {
                    p.stock = Math.max(0, p.stock - item.qty);
                }
            }
        },
    };
}

export function createMemoryBalanceDB(): BalanceDB {
    return {
        async get(): Promise<Balances> {
            return { ...inMemoryBalances };
        },
        async update(ngn: number, usdc: number): Promise<Balances> {
            inMemoryBalances = { ngn, usdc };
            return { ...inMemoryBalances };
        },
        async creditNgn(amount: number): Promise<Balances> {
            inMemoryBalances.ngn += amount;
            return { ...inMemoryBalances };
        },
        async debitNgn(amount: number): Promise<Balances> {
            if (amount > inMemoryBalances.ngn) {
                throw new Error(`Insufficient funds: requested ₦${amount}, current balance ₦${inMemoryBalances.ngn}`);
            }
            inMemoryBalances.ngn -= amount;
            return { ...inMemoryBalances };
        },
        async convert(ngnAmount: number, usdcAmount: number): Promise<Balances> {
            if (ngnAmount > inMemoryBalances.ngn) {
                throw new Error(`Insufficient funds: requested ₦${ngnAmount}, current balance ₦${inMemoryBalances.ngn}`);
            }
            inMemoryBalances.ngn -= ngnAmount;
            inMemoryBalances.usdc += usdcAmount;
            return { ...inMemoryBalances };
        },
    };
}

export function createMemoryLedgerDB(): LedgerDB {
    return {
        async create(entry: LedgerEntry): Promise<LedgerEntry> {
            inMemoryLedger.unshift(entry);
            return entry;
        },
        async list(status?: string): Promise<LedgerEntry[]> {
            let res = [...inMemoryLedger];
            if (status && status !== "all") {
                res = res.filter((e) => e.status === status);
            }
            return res;
        },
    };
}

export function createMemoryPaymentDB(): PaymentDB {
    return {
        async create(payment: PaymentRecord): Promise<void> {
            inMemoryPayments.unshift(payment);
        },
        async findByEventId(eventId: string): Promise<PaymentRecord | null> {
            return inMemoryPayments.find((p) => p.bushaEventId === eventId) || null;
        },
    };
}
