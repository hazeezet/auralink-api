import { standardSuccessResponseSchema } from "#src/lib/common";
import type { FastifySchema } from "fastify";

export const withdrawSchema: FastifySchema = {
    tags: ["Treasury"],
    summary: "Withdraw Naira to Nigerian bank",
    description: "Initiates a payout quote via Busha to Amaka's settlement bank account.",
    body: {
        type: "object",
        required: ["amount"],
        properties: {
            amount: { type: "number", minimum: 100 },
            bankCode: { type: "string" },
            accountNumber: { type: "string" },
        },
    },
    response: {
        200: standardSuccessResponseSchema({
            type: "object",
            properties: {
                success: { type: "boolean" },
                quoteId: { type: "string", nullable: true },
                balances: {
                    type: "object",
                    properties: {
                        ngn: { type: "number" },
                        usdc: { type: "number" },
                    },
                },
            },
        }, "Withdrawal initiated successfully"),
    },
};

export const convertSchema: FastifySchema = {
    tags: ["Treasury"],
    summary: "Convert Naira to USDC (Restock Vault)",
    description: "Converts operational Naira funds into USDC via Busha Quotes to hedge inventory restocking against currency devaluation.",
    body: {
        type: "object",
        required: ["amountNgn"],
        properties: {
            amountNgn: { type: "number", minimum: 1 },
        },
    },
    response: {
        200: standardSuccessResponseSchema({
            type: "object",
            properties: {
                success: { type: "boolean" },
                usdcGained: { type: "number" },
                balances: {
                    type: "object",
                    properties: {
                        ngn: { type: "number" },
                        usdc: { type: "number" },
                    },
                },
            },
        }, "Conversion completed successfully"),
    },
};

