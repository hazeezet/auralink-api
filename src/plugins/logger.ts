import fp from "fastify-plugin";
import type { Logger } from "winston";
import { appLogger } from "#src/lib/logger";

declare module "fastify" {
    interface FastifyInstance {
        winston: Logger;
    }
}

export default fp(async function (fastify) {
    if (!fastify.hasDecorator("winston")) {
        fastify.decorate("winston", appLogger);
    }
}, {
    name: "winston-logger",
});
