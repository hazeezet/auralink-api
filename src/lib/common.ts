/**
 * Reusable JSON Schema builders for Fastify standard API envelopes.
 */

export const standardErrorResponseSchema = (statusCode: number, description?: string) => ({
    description: description || `Error ${statusCode}`,
    type: "object",
    properties: {
        status_code: { type: "number", example: statusCode },
        error: { type: "string" },
        message: { type: "string" },
        data: { type: "null", nullable: true },
    },
    required: ["status_code", "error", "message", "data"],
});

export interface StandardSuccessResponseOptions {
    nullable?: boolean;
}

export const standardSuccessResponseSchema = (
    dataSchema?: Record<string, unknown> | null,
    message = "success",
    options?: StandardSuccessResponseOptions,
) => {
    let data: Record<string, unknown>;

    if (!dataSchema || Object.keys(dataSchema).length === 0) {
        data = { type: ["object", "null"], nullable: true };
    } else {
        const isDirectSchema = typeof dataSchema.type === "string" || Array.isArray(dataSchema.type);
        const baseData = isDirectSchema
            ? dataSchema
            : {
                type: "object",
                properties: dataSchema,
                required: Object.keys(dataSchema),
            };

        data = options?.nullable
            ? {
                anyOf: [
                    baseData,
                    { type: "null" },
                    { type: "object" },
                ],
            }
            : baseData;
    }

    return {
        type: "object",
        properties: {
            status_code: { type: "number", example: 200 },
            error: { type: ["string", "null"], nullable: true },
            message: { type: "string", example: message },
            data,
        },
        required: ["status_code", "error", "message", "data"],
    };
};

export const paginationSchema = {
    type: "object",
    properties: {
        page: { type: "integer", example: 1 },
        limit: { type: "integer", example: 20 },
        total: { type: "integer", example: 50 },
        total_pages: { type: "integer", example: 3 },
        has_more: { type: "boolean", example: true },
    },
    required: ["page", "limit", "total", "total_pages", "has_more"],
};

export const standardPaginatedResponseSchema = (itemSchema: Record<string, unknown>, message = "success") => ({
    type: "object",
    properties: {
        status_code: { type: "number", example: 200 },
        error: { type: "null", nullable: true },
        message: { type: "string", example: message },
        data: {
            type: "array",
            items: itemSchema,
        },
        pagination: paginationSchema,
    },
    required: ["status_code", "error", "message", "data", "pagination"],
});
