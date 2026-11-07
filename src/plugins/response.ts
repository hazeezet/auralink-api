import fp from "fastify-plugin";
import type { ApiResponse } from "#types/response";

declare module "fastify" {
    interface FastifyReply {
        response: ApiResponse;
    }
}

export default fp(async function (fastify, _opts) {
    fastify.decorateReply("response", null as unknown as ApiResponse);

    fastify.addHook("onRequest", function (_request, reply, done) {
        reply.response = {
            status_code: 200,
            error: null,
            message: "success",
            data: {},
        };
        done();
    });
});
