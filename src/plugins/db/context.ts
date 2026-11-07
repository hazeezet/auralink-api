import fp from "fastify-plugin";
import { createDatabaseContext, type DatabaseContext } from "../../db";

declare module "fastify" {
    interface FastifyInstance {
        db: DatabaseContext;
    }
}

export default fp(async function (fastify, _opts) {
    if (!fastify.hasDecorator("db")) {
        const db = createDatabaseContext(fastify.supabase);
        fastify.decorate("db", db);
    }
}, {
    name: "db-context",
    dependencies: ["supabase"],
});

