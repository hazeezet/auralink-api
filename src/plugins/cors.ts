import fp from "fastify-plugin";
import fastifyCors from "@fastify/cors";

export default fp(async function (fastify, _opts) {
    await fastify.register(fastifyCors, {
        origin: true, // Allow all origins in dev/sandbox
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-bu-signature", "x-busha-signature"],
        credentials: true,
    });
}, {
    name: "cors",
});

