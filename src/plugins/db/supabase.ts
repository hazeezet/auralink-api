import fp from "fastify-plugin";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, assertSupabaseConfigured } from "../../config";

declare module "fastify" {
    interface FastifyInstance {
        supabase: SupabaseClient;
    }
}

export default fp(async function (fastify, _opts) {
    assertSupabaseConfigured();

    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    fastify.decorate("supabase", supabase);
}, {
    name: "supabase",
});
