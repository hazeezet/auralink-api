import { type FastifyPluginAsync, type FastifySchema } from "fastify";
import { standardSuccessResponseSchema } from "#src/lib/common";

const healthSchema: FastifySchema = {
    tags: ["System"],
    summary: "API health check",
    description: "Check backend service availability and uptime",
    response: {
        200: standardSuccessResponseSchema({
            uptime: { type: "number" },
            timestamp: { type: "string" },
        }),
    },
};

const root: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
    fastify.get("/health", { schema: healthSchema }, async function (_request, reply) {
        reply.response.message = "Health check successful";
        reply.response.data = {
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        };
        return reply.send(reply.response);
    });
};

export default root;
