import fp from "fastify-plugin";
import { bushaClient, type BushaClient } from "../lib/busha";

declare module "fastify" {
    interface FastifyInstance {
        busha: BushaClient;
    }
}

export default fp(async function (fastify, _opts) {
    if (!fastify.hasDecorator("busha")) {
        fastify.decorate("busha", bushaClient);
    }
}, {
    name: "busha",
});
