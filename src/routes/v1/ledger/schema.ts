import { standardSuccessResponseSchema } from "#src/lib/common";
import type { FastifySchema } from "fastify";

export const ledgerEntrySchema = {
    type: "object",
    properties: {
        id: { type: "string" },
        orderId: { type: "string", nullable: true },
        customer: { type: "string" },
        amountReceived: { type: "number" },
        currency: { type: "string", enum: ["NGN", "USDC"] },
        nairaValue: { type: "number" },
        fee: { type: "number" },
        net: { type: "number" },
        status: { type: "string", enum: ["settled", "pending", "flagged"] },
        createdAt: { type: "string" },
        bushaEventId: { type: "string" },
    },
};

export const listLedgerSchema: FastifySchema = {
    tags: ["Ledger"],
    summary: "List ledger entries",
    description: "Returns every confirmed payment as one immutable line item.",
    querystring: {
        type: "object",
        properties: {
            status: { type: "string", enum: ["settled", "pending", "flagged"] },
        },
    },
    response: {
        200: standardSuccessResponseSchema({
            type: "array",
            items: ledgerEntrySchema,
        }, "Ledger entries retrieved successfully"),
    },
};

export const getBalancesSchema: FastifySchema = {
    tags: ["Treasury"],
    summary: "Get current merchant balances",
    description: "Returns Amaka's current Naira and USDC balances.",
    response: {
        200: standardSuccessResponseSchema({
            type: "object",
            properties: {
                ngn: { type: "number" },
                usdc: { type: "number" },
            },
        }, "Balances retrieved successfully"),
    },
};
