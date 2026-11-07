/**
 * Concrete, well-known application error codes.
 */
export const ErrorCodes = {
    // Client Errors (4xx)
    BAD_REQUEST: "BAD_REQUEST",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    CONFLICT: "CONFLICT",
    UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
    TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
    VALIDATION_ERROR: "VALIDATION_ERROR",

    // Auth & Identity
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    USER_NOT_FOUND: "USER_NOT_FOUND",
    USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS",
    TOKEN_EXPIRED: "TOKEN_EXPIRED",
    TOKEN_INVALID: "TOKEN_INVALID",
    SESSION_EXPIRED: "SESSION_EXPIRED",

    // Supabase / Database Errors
    DATABASE_ERROR: "DATABASE_ERROR",
    RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
    RECORD_ALREADY_EXISTS: "RECORD_ALREADY_EXISTS",

    // Server Errors (5xx)
    INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
    SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
    GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Pagination metadata for collection responses.
 */
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
}

/**
 * Standard database collection query result with total count.
 */
export interface PaginatedResult<T> {
    items: T[];
    total: number;
}

/**
 * Standard API Response envelope.
 */
export interface ApiResponse<T = unknown> {
    status_code: number;
    error: ErrorCode | null;
    message: string;
    data: T;
    pagination?: PaginationMeta | null;
}
