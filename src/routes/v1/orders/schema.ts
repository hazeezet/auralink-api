import { standardSuccessResponseSchema } from "#src/lib/common";
import type { FastifySchema } from "fastify";

const orderItemSchema = {
    type: "object",
    properties: {
        productId: { type: "string" },
        name: { type: "string" },
        qty: { type: "number" },
        unitPrice: { type: "number" },
        emoji: { type: "string" },
    },
};

const timelineEventSchema = {
    type: "object",
    properties: {
        id: { type: "string" },
        label: { type: "string" },
        note: { type: "string", nullable: true },
        at: { type: "string" },
        tone: { type: "string", enum: ["neutral", "good", "warn", "bad"] },
    },
};

export const orderObjectSchema = {
    type: "object",
    properties: {
        id: { type: "string" },
        customer: { type: "string" },
        handle: { type: "string" },
        city: { type: "string" },
        channel: { type: "string", enum: ["NGN", "USDC"] },
        items: { type: "array", items: orderItemSchema },
        subtotal: { type: "number" },
        discount: { type: "number" },
        total: { type: "number" },
        status: { type: "string", enum: ["awaiting", "paid", "underpaid", "expired", "late_paid", "cancelled"] },
        ref: { type: "string" },
        expiresAt: { type: "string" },
        createdAt: { type: "string" },
        paidAt: { type: "string", nullable: true },
        receivedNgn: { type: "number", nullable: true },
        note: { type: "string", nullable: true },
        timeline: { type: "array", items: timelineEventSchema },
    },
};

export const createOrderSchema: FastifySchema = {
    tags: ["Orders"],
    summary: "Create order and generate one-time Busha payment link",
    description: "Validates inventory, calculates total, generates Busha hosted paylink, and stores order.",
    body: {
        type: "object",
        required: ["customer", "channel", "items"],
        properties: {
            customer: { type: "string", minLength: 1 },
            handle: { type: "string" },
            city: { type: "string" },
            channel: { type: "string", enum: ["NGN", "USDC"] },
            items: {
                type: "array",
                minItems: 1,
                items: {
                    type: "object",
                    required: ["productId", "qty"],
                    properties: {
                        productId: { type: "string" },
                        qty: { type: "integer", minimum: 1 },
                    },
                },
            },
            discount: { type: "number", minimum: 0 },
            note: { type: "string" },
        },
    },
    response: {
        201: standardSuccessResponseSchema(orderObjectSchema, "Order created successfully"),
    },
};

export const listOrdersSchema: FastifySchema = {
    tags: ["Orders"],
    summary: "List orders",
    description: "Returns list of orders for Amaka with optional status and text search filtering.",
    querystring: {
        type: "object",
        properties: {
            status: { type: "string" },
            q: { type: "string" },
        },
    },
    response: {
        200: standardSuccessResponseSchema({
            type: "array",
            items: orderObjectSchema,
        }, "Orders retrieved successfully"),
    },
};

export const getOrderSchema: FastifySchema = {
    tags: ["Orders"],
    summary: "Get order by ID",
    params: {
        type: "object",
        required: ["id"],
        properties: {
            id: { type: "string" },
        },
    },
    response: {
        200: standardSuccessResponseSchema(orderObjectSchema, "Order retrieved successfully"),
    },
};

export const getOrderByRefSchema: FastifySchema = {
    tags: ["Orders"],
    summary: "Get order by Busha reference string",
    description: "Used by the public buyer checkout page to fetch order details and timer.",
    params: {
        type: "object",
        required: ["ref"],
        properties: {
            ref: { type: "string" },
        },
    },
    response: {
        200: standardSuccessResponseSchema(orderObjectSchema, "Order retrieved successfully"),
    },
};

export const cancelOrderSchema: FastifySchema = {
    tags: ["Orders"],
    summary: "Cancel an awaiting order",
    params: {
        type: "object",
        required: ["id"],
        properties: {
            id: { type: "string" },
        },
    },
    response: {
        200: standardSuccessResponseSchema(orderObjectSchema, "Order cancelled successfully"),
    },
};

export const simulatePaymentSchema: FastifySchema = {
    tags: ["Orders"],
    summary: "Simulate a payment for judging demo",
    params: {
        type: "object",
        required: ["id"],
        properties: {
            id: { type: "string" },
        },
    },
    body: {
        type: "object",
        properties: {
            amountNgn: { type: "number" },
        },
    },
    response: {
        200: standardSuccessResponseSchema(orderObjectSchema, "Payment simulated successfully"),
    },
};
