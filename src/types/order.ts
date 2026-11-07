export type OrderStatus =
    | "awaiting"
    | "paid"
    | "underpaid"
    | "expired"
    | "late_paid"
    | "cancelled";

export type Channel = "NGN" | "USDC";

export interface OrderItem {
    productId: string;
    name: string;
    qty: number;
    unitPrice: number;
    emoji: string;
}

export interface TimelineEvent {
    id: string;
    label: string;
    note?: string;
    at: string;
    tone: "neutral" | "good" | "warn" | "bad";
}

export interface Order {
    id: string;
    customer: string;
    handle: string;
    city: string;
    channel: Channel;
    items: OrderItem[];
    subtotal: number;
    discount: number;
    total: number;
    status: OrderStatus;
    ref: string;
    expiresAt: string;
    createdAt: string;
    paidAt?: string;
    receivedNgn?: number;
    note?: string;
    timeline: TimelineEvent[];
}

export interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    emoji: string;
    sku: string;
}

export interface CreateOrderInput {
    customer: string;
    handle?: string;
    city?: string;
    channel: Channel;
    items: { productId: string; qty: number }[];
    discount?: number;
    note?: string;
    products?: Product[];
}
