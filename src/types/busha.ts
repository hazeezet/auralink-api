export interface BushaCreatePaymentLinkRequest {
    title: string;
    description?: string;
    amount: number;
    currency: "NGN" | "USD" | "USDC" | "USDT";
    expires_in?: number; // seconds
    redirect_url?: string;
    cancel_url?: string;
    customer_id?: string;
    metadata?: Record<string, unknown>;
}

export interface BushaPaymentLinkResponse {
    id: string;
    reference: string;
    url: string;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    status: string;
    expires_at: string;
    created_at: string;
    metadata?: Record<string, unknown>;
}

export interface BushaCreateCustomerRequest {
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
}

export interface BushaCustomerResponse {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    created_at: string;
}

export interface BushaQuoteRequest {
    source_currency: string;
    target_currency: string;
    source_amount?: number;
    target_amount?: number;
    type?: "standard" | "withdrawal";
}

export interface BushaQuoteResponse {
    id: string;
    source_currency: string;
    target_currency: string;
    source_amount: number;
    target_amount: number;
    rate: number;
    expires_at: string;
}

export interface BushaWebhookPayload {
    event: string; // e.g. "payment.successful", "payment.underpaid", "payment_request.confirmed"
    event_id: string;
    created_at: string;
    data: {
        id?: string;
        reference: string;
        amount_received: number;
        currency: "NGN" | "USDC" | "USDT" | string;
        network?: string;
        naira_value?: number;
        fee?: number;
        status: string;
        customer?: {
            id?: string;
            name?: string;
            email?: string;
        };
        metadata?: {
            order_id?: string;
            merchant_id?: string;
            [key: string]: unknown;
        };
    };
}

