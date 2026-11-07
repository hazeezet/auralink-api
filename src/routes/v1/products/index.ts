import type { FastifyPluginAsync } from "fastify";
import { listProductsSchema } from "./schema";

const productsRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
    /**
     * GET /v1/products - List Catalogue Products
     */
    fastify.get(
        "/",
        { schema: listProductsSchema },
        async (_request, reply) => {
            const list = await fastify.db.products.list();
            reply.response.message = "Products retrieved successfully";
            reply.response.data = list;
            return reply.send(reply.response);
        },
    );
};

export default productsRoutes;
