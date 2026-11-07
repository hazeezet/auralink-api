import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, assertSupabaseConfigured } from "../config";
import { appLogger } from "./logger";

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (!supabaseInstance) {
        assertSupabaseConfigured();
        appLogger.info("Initializing Supabase client", { url: config.supabase.url });
        supabaseInstance = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
    }
    return supabaseInstance;
}
