import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
    dotenv.config();
}

export const config = {
    env: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT) || 5000,
    host: process.env.HOST || "0.0.0.0",

    busha: {
        baseUrl: process.env.BUSHA_BASE_URL || "https://api.sandbox.busha.so",
        secretKey: process.env.BUSHA_SECRET_KEY || "",
        webhookSecret: process.env.BUSHA_WEBHOOK_SECRET || "",
    },

    supabase: {
        url: process.env.SUPABASE_URL || "",
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "",
    },

    rates: {
        usdcNgn: 1615.4,
        feePercent: 0.8,
        quoteMinutes: 15,
        underpayTolerancePercent: 1.0,
    },
};

export function assertBushaConfigured(): void {
    if (!config.busha.secretKey) {
        throw new Error(
            "Busha API configuration missing: BUSHA_SECRET_KEY must be set in .env to connect to Busha Sandbox.",
        );
    }
}

export function assertSupabaseConfigured(): void {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
        throw new Error(
            "Supabase configuration missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.",
        );
    }
}

