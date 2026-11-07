import type { Channel } from "./order";

export interface LedgerEntry {
    id: string;
    orderId: string | null;
    customer: string;
    amountReceived: number;
    currency: Channel;
    nairaValue: number;
    fee: number;
    net: number;
    status: "settled" | "pending" | "flagged";
    createdAt: string;
    bushaEventId: string;
}

export interface Balances {
    ngn: number;
    usdc: number;
}

export interface PayoutInput {
    amount: number;
    bankCode?: string;
    accountNumber?: string;
}

export interface ConvertInput {
    amountNgn: number;
}

