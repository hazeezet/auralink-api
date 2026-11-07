import crypto from "node:crypto";
import { config, assertBushaConfigured } from "../config";
import { appLogger } from "./logger";
import type {
    BushaCreatePaymentLinkRequest,
    BushaPaymentLinkResponse,
    BushaCreateCustomerRequest,
    BushaCustomerResponse,
    BushaQuoteRequest,
    BushaQuoteResponse,
} from "../types/busha";

export class BushaApiError extends Error {
    statusCode: number;
    responseBody?: unknown;

    constructor(message: string, statusCode = 500, responseBody?: unknown) {
        super(message);
        this.name = "BushaApiError";
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }
}

export class BushaClient {
    private readonly baseUrl: string;
    private readonly secretKey: string;
    private readonly webhookSecret: string;

    constructor() {
        this.baseUrl = config.busha.baseUrl;
        this.secretKey = config.busha.secretKey;
        this.webhookSecret = config.busha.webhookSecret;
    }

    private getHeaders(): Record<string, string> {
        assertBushaConfigured();
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.secretKey}`,
            "X-BP-Key": this.secretKey,
            "Accept": "application/json",
        };
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { ...this.getHeaders(), ...(options.headers as Record<string, string> || {}) };

        appLogger.info(`[Busha API] ${options.method || "GET"} ${url}`);

        let res: Response;
        try {
            res = await fetch(url, { ...options, headers });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Network error contacting Busha";
            appLogger.error(`[Busha API Network Error] ${url}: ${message}`);
            throw new BushaApiError(`Failed to connect to Busha API: ${message}`, 502);
        }

        let body: unknown;
        const text = await res.text();
        try {
            body = text ? JSON.parse(text) : {};
        } catch {
            body = text;
        }

        if (!res.ok) {
            const errorMsg = typeof body === "object" && body !== null && "message" in body
                ? String((body as { message: unknown }).message)
                : `Busha API responded with HTTP ${res.status}`;

            appLogger.error(`[Busha API Error] ${options.method || "GET"} ${url} [${res.status}]:`, { body });
            throw new BushaApiError(errorMsg, res.status, body);
        }

        const unwrapped = typeof body === "object" && body !== null && "data" in body
            ? (body as { data: T }).data
            : (body as T);

        return unwrapped;
    }

    /**
     * Creates a one-time hosted payment link for an order.
     */
    async createPaymentLink(payload: BushaCreatePaymentLinkRequest): Promise<BushaPaymentLinkResponse> {
        return this.request<BushaPaymentLinkResponse>("/v1/payments/links", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    /**
     * Retrieves status and details of an existing payment link.
     */
    async getPaymentLink(linkIdOrRef: string): Promise<BushaPaymentLinkResponse> {
        return this.request<BushaPaymentLinkResponse>(`/v1/payments/links/${encodeURIComponent(linkIdOrRef)}`, {
            method: "GET",
        });
    }

    /**
     * Registers a customer (merchant sub-account or profile) in Busha.
     */
    async createCustomer(payload: BushaCreateCustomerRequest): Promise<BushaCustomerResponse> {
        return this.request<BushaCustomerResponse>("/v1/customers/individual", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    /**
     * Creates a currency conversion or withdrawal payout quote.
     */
    async createQuote(payload: BushaQuoteRequest): Promise<BushaQuoteResponse> {
        return this.request<BushaQuoteResponse>("/v1/quotes", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    /**
     * Verifies that the webhook request is genuinely from Busha using HMAC-SHA256.
     */
    verifyWebhookSignature(rawBody: string, signatureHeader?: string): boolean {
        const secret = this.webhookSecret || this.secretKey;
        if (!secret) {
            appLogger.warn("[Busha Webhook] Verification skipped: No webhook secret configured");
            return false;
        }
        if (!signatureHeader) {
            return false;
        }

        try {
            const expected = crypto
                .createHmac("sha256", secret)
                .update(rawBody, "utf8")
                .digest("hex");

            const sigBuffer = Buffer.from(signatureHeader, "hex");
            const expectedBuffer = Buffer.from(expected, "hex");

            if (sigBuffer.length !== expectedBuffer.length) {
                return false;
            }

            return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
        } catch (err) {
            appLogger.error("[Busha Webhook Signature Error]", err);
            return false;
        }
    }
}

export const bushaClient = new BushaClient();
