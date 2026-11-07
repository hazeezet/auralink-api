import fp from "fastify-plugin";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

export default fp(async function (fastify, _opts) {
    await fastify.register(fastifySwagger, {
        openapi: {
            openapi: "3.0.3",
            info: {
                title: "AURALINK API",
                description: "Backend API",
                version: "1.0.0",
            },
            servers: [
                {
                    url: "http://127.0.0.1:5000",
                    description: "Local development server",
                },
            ],
            components: {
                securitySchemes: {
                    tokenAuth: {
                        type: "apiKey",
                        name: "token",
                        in: "header",
                        description: "Provide session token in 'token' header",
                    },
                },
            },
            tags: [
                { name: "System", description: "System health & monitoring endpoints" },
            ],
        },
    });

    await fastify.register(fastifySwaggerUi, {
        routePrefix: "/docs",
        uiConfig: {
            docExpansion: "list",
            deepLinking: true,
        },
        staticCSP: true,
        transformSpecificationClone: true,
    });
});
