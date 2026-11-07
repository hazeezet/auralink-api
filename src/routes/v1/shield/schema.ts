import { standardSuccessResponseSchema } from "#src/lib/common";
import type { FastifySchema } from "fastify";

export const scanScreenshotSchema: FastifySchema = {
    tags: ["Screenshot Shield"],
    summary: "Scan and verify bank transfer screenshot",
    description: "Extracts transaction details from a customer receipt and cross-checks against Busha gateway logs to detect fake transfer alerts.",
    body: {
        type: "object",
        required: ["fileName"],
        properties: {
            fileName: { type: "string", minLength: 1 },
        },
    },
    response: {
        200: standardSuccessResponseSchema({
            type: "object",
            properties: {
                amount: { type: "number" },
                currency: { type: "string" },
                sender: { type: "string" },
                at: { type: "string" },
                reference: { type: "string" },
                confidence: { type: "number" },
                verdict: { type: "string", enum: ["verified", "mismatch", "fake"] },
                verdictMessage: { type: "string" },
            },
        }, "Screenshot analyzed successfully"),
    },
};

