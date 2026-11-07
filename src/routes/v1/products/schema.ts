import { standardSuccessResponseSchema } from "#src/lib/common";
import type { FastifySchema } from "fastify";

export const productItemSchema = {
    type: "object",
    properties: {
        id: { type: "string" },
        name: { type: "string" },
        price: { type: "number" },
        stock: { type: "number" },
        emoji: { type: "string" },
        sku: { type: "string" },
    },
};

export const listProductsSchema: FastifySchema = {
    tags: ["Products"],
    summary: "List catalogue products and stock levels",
    response: {
        200: standardSuccessResponseSchema({
            type: "array",
            items: productItemSchema,
        }, "Products retrieved successfully"),
    },
};
