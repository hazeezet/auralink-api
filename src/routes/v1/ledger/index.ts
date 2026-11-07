import type { FastifyPluginAsync } from "fastify";
import { getBalancesSchema, listLedgerSchema } from "./schema";

const ledgerRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
    /**
     * GET /v1/ledger - List Ledger Entries
     */
    fastify.get<{ Querystring: { status?: string } }>(
        "/",
        { schema: listLedgerSchema },
        async (request, reply) => {
            const list = await fastify.db.ledger.list(request.query.status);
            reply.response.message = "Ledger entries retrieved successfully";
            reply.response.data = list;
            return reply.send(reply.response);
        },
    );

    /**
     * GET /v1/ledger/balances - Get Current Balances
     */
    fastify.get(
        "/balances",
        { schema: getBalancesSchema },
        async (_request, reply) => {
            const balances = await fastify.db.balances.get();
            reply.response.message = "Balances retrieved successfully";
            reply.response.data = balances;
            return reply.send(reply.response);
        },
    );
};

export default ledgerRoutes;
