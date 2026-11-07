import type { FastifyPluginAsync } from "fastify";
import { getBalancesSchema } from "./ledger/schema";

const balancesRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
    /**
     * GET /v1/balances - Get Current Balances
     */
    fastify.get(
        "/",
        { schema: getBalancesSchema },
        async (_request, reply) => {
            const balances = await fastify.db.balances.get();
            reply.response.message = "Balances retrieved successfully";
            reply.response.data = balances;
            return reply.send(reply.response);
        },
    );
};

export default balancesRoutes;

