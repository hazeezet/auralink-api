import * as path from "node:path";
import AutoLoad, { type AutoloadPluginOptions } from "@fastify/autoload";
import { type FastifyPluginAsync } from "fastify";
import { ErrorCodes } from "#types/response";
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
    dotenv.config();
}

export type AppOptions = {
  // Place your custom options for app below here.
} & Partial<AutoloadPluginOptions>;

const options: AppOptions = {};

import { appLogger } from "#src/lib/logger";

interface CustomError {
  statusCode?: number;
  code?: string;
  message?: string;
}

const app: FastifyPluginAsync<AppOptions> = async (
    fastify,
    opts,
): Promise<void> => {
    // This loads all plugins defined in plugins
    void fastify.register(AutoLoad, {
        dir: path.join(__dirname, "plugins"),
        options: opts,
    });

    // Default Not Found handler returning standard envelope
    fastify.setNotFoundHandler(function (_request, reply) {
        reply.response.status_code = 404;
        reply.response.error = ErrorCodes.NOT_FOUND;
        reply.response.message = "The requested route could not be found";
        reply.response.data = null;
        reply.status(404).send(reply.response);
    });

    // Centralized error handler returning standard envelope
    fastify.setErrorHandler(function (error: unknown, request, reply) {
        request.log.error(error);
        appLogger.error(`[${request.method} ${request.url}] Error:`, {
            err: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
        const err = error as CustomError;
        const statusCode = err?.statusCode || 500;
        reply.response.status_code = statusCode;
        reply.response.error = statusCode >= 500
            ? ErrorCodes.INTERNAL_SERVER_ERROR
            : ErrorCodes.BAD_REQUEST;
        reply.response.message = statusCode >= 500
            ? "Internal server error"
            : (err?.message || "An unexpected error occurred");
        reply.response.data = null;

        reply.status(statusCode).send(reply.response);
    });

    // This loads all plugins defined in routes
    void fastify.register(AutoLoad, {
        dir: path.join(__dirname, "routes"),
        options: opts,
    });
};

export default app;
export { app, options };
