import { standardSuccessResponseSchema } from "#src/lib/common";
import type { FastifySchema } from "fastify";

export const bushaWebhookSchema: FastifySchema = {
    tags: ["Webhooks"],
    summary: "Inbound Busha webhook listener",
    description: "Verifies HMAC signature, enforces idempotency, updates order status, and inscribes ledger row.",
    body: {
        type: "object",
        required: ["event", "event_id", "data"],
        properties: {
            event: { type: "string" },
            event_id: { type: "string" },
            created_at: { type: "string" },
            data: {
                type: "object",
                required: ["reference", "amount_received"],
                properties: {
                    reference: { type: "string" },
                    amount_received: { type: "number" },
                    currency: { type: "string" },
                    network: { type: "string" },
                    naira_value: { type: "number" },
                    fee: { type: "number" },
                    status: { type: "string" },
                    metadata: { type: "object", additionalProperties: true },
                },
            },
        },
    },
    response: {
        200: standardSuccessResponseSchema({
            type: "object",
            properties: {
                processed: { type: "boolean" },
                event_id: { type: "string" },
            },
        }, "Webhook processed successfully"),
    },
};

