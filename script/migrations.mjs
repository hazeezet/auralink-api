import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
    const envPath = path.join(repoRoot, ".env");
    if (existsSync(envPath)) {
        const lines = readFileSync(envPath, "utf8").split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
                const [key, ...rest] = trimmed.split("=");
                const val = rest.join("=").replace(/^['"](.*)['"]$/, "$1");
                if (!process.env[key.trim()]) {
                    process.env[key.trim()] = val.trim();
                }
            }
        }
    }
}

function getDbUrl() {
    loadEnv();
    if (process.env.SUPABASE_MIGRATION_DB_URL) {
        return process.env.SUPABASE_MIGRATION_DB_URL.trim();
    }
    const baseUrl = process.env.SUPABASE_URL;
    if (!baseUrl) {
        console.error("\x1b[31mError:\x1b[0m Neither SUPABASE_MIGRATION_DB_URL nor SUPABASE_URL is configured in .env");
        process.exit(1);
    }
    const parsed = new URL(baseUrl);
    return `postgresql://postgres:postgres@${parsed.hostname}:5432/postgres?sslmode=disable`;
}

function run(command, args) {
    const res = spawnSync("pnpx", ["supabase", command, ...args], {
        cwd: repoRoot,
        env: process.env,
        stdio: "inherit",
    });
    if (res.error) {
        console.error(`\x1b[31mExecution Error:\x1b[0m ${res.error.message}`);
        process.exit(1);
    }
    if (res.status !== 0) {
        process.exit(res.status ?? 1);
    }
}

function main() {
    loadEnv();
    const [action = "list", targetName] = process.argv.slice(2);
    const dbUrl = getDbUrl();

    switch (action) {
        case "list":
        case "status": {
            run("migration", ["list", "--db-url", dbUrl]);
            break;
        }
        case "plan": {
            run("db", ["push", "--dry-run", "--skip-vault", "--db-url", dbUrl]);
            break;
        }
        case "apply":
        case "up": {
            run("db", ["push", "--yes", "--skip-vault", "--db-url", dbUrl]);
            console.log(`\n\x1b[90mRun "pnpm migrate:list" or "supabase migration list" to show the updated migration history.\x1b[0m\n`);
            break;
        }
        case "new": {
            if (!targetName) {
                console.error("Usage: pnpm migrate:new <migration_name>");
                process.exit(1);
            }
            run("migration", ["new", targetName]);
            break;
        }
        default: {
            console.log(`
MHMW Supabase Migration Runner

Usage: node script/migrations.mjs <action> [options]

Actions:
  list, status    List applied and pending migrations
  plan            Preview migrations to be applied (dry-run)
  apply, up       Apply all pending migrations to the database
  new <name>      Create a new timestamped migration file
`);
            process.exit(action === "help" || action === "--help" ? 0 : 1);
        }
    }
}

main();
