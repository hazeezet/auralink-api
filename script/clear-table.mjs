import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
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

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function executeSql(sql, dbUrl) {
    const res = spawnSync("pnpx", ["supabase", "db", "query", sql, "--db-url", dbUrl], {
        cwd: repoRoot,
        env: process.env,
        encoding: "utf8",
    });
    if (res.status !== 0) {
        const err = res.stderr || res.stdout || `Exit code ${res.status}`;
        throw new Error(err.trim());
    }
    return res.stdout;
}

async function main() {
    loadEnv();
    const args = process.argv.slice(2);
    const force = args.includes("-y") || args.includes("--yes");
    let table = args.find((a) => {
        return !a.startsWith("-");
    });

    if (!table) {
        table = await ask("Enter the name of the table to clear/truncate: ");
    }

    if (!table) {
        console.error("No table specified. Aborted.");
        process.exit(1);
    }

    const cleanTable = table.trim().replace(/^public\./, "");
    if (!/^[a-zA-Z0-9_]+$/.test(cleanTable)) {
        console.error(`Invalid table name '${cleanTable}'. Only alphanumeric characters and underscores allowed.`);
        process.exit(1);
    }

    if (!force) {
        const confirm = await ask(`\x1b[33mWarning:\x1b[0m Are you sure you want to DELETE ALL records from '${cleanTable}'? (y/N): `);
        if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
            console.log("Cancelled. No records were deleted.");
            return;
        }
    }

    const dbUrl = getDbUrl();
    try {
        process.stdout.write(`Truncating table '${cleanTable}'... `);
        executeSql(`TRUNCATE TABLE public."${cleanTable}" RESTART IDENTITY CASCADE;`, dbUrl);
        console.log(`\x1b[32mdone\x1b[0m\nAll records in '${cleanTable}' have been cleared.\n`);
    } catch (err) {
        console.error(`\n\x1b[31mFailed to clear table:\x1b[0m ${err.message}`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`);
    process.exit(1);
});
