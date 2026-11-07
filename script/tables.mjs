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

function getSupabaseConfig() {
    loadEnv();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url) {
        console.error("\x1b[31mError:\x1b[0m SUPABASE_URL is not set in .env");
        process.exit(1);
    }
    if (!key) {
        console.error("\x1b[31mError:\x1b[0m SUPABASE_SECRET_KEY is not set in .env");
        process.exit(1);
    }
    return { url: url.replace(/\/+$/, ""), key };
}

function getDbUrl() {
    loadEnv();
    let url = "";
    if (process.env.SUPABASE_MIGRATION_DB_URL) {
        url = process.env.SUPABASE_MIGRATION_DB_URL.trim();
    } else {
        const { url: baseUrl } = getSupabaseConfig();
        const parsed = new URL(baseUrl);
        url = `postgresql://postgres:postgres@${parsed.hostname}:5432/postgres?sslmode=disable`;
    }
    if (!url.includes("default_query_exec_mode=")) {
        const sep = url.includes("?") ? "&" : "?";
        url = `${url}${sep}default_query_exec_mode=simple_protocol`;
    }
    return url;
}

function executeSql(sql) {
    const dbUrl = getDbUrl();
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

async function getPublicTables() {
    const { url, key } = getSupabaseConfig();
    const res = await fetch(`${url}/rest/v1/`, {
        headers: {
            "apikey": key,
            "Authorization": `Bearer ${key}`,
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch schema from ${url}/rest/v1/: ${res.statusText} (HTTP ${res.status})`);
    }

    const data = await res.json();
    return Object.keys(data.definitions || {}).sort();
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

async function listAction() {
    const { url } = getSupabaseConfig();
    console.log(`\nConnecting to Supabase at ${url}...`);
    const tables = await getPublicTables();
    if (tables.length === 0) {
        console.log("No public tables found.\n");
        return;
    }
    console.log(`Found ${tables.length} public table(s):\n`);
    for (let i = 0; i < tables.length; i++) {
        const name = tables[i];
        const isOld = name.startsWith("old_");
        const tag = isOld ? "\x1b[33m[OLD]\x1b[0m" : "\x1b[32m[CURRENT]\x1b[0m";
        console.log(`  ${String(i + 1).padStart(2, " ")}) ${tag} ${name}`);
    }
    console.log("");
}

async function renameTable(oldName) {
    const newName = oldName.startsWith("old_") ? oldName : `old_${oldName}`;
    if (oldName === newName) {
        console.log(`  Skipping '${oldName}' (already prefixed with 'old_')`);
        return;
    }
    process.stdout.write(`  Renaming '${oldName}' -> '${newName}' ... `);
    const sql = `ALTER TABLE public."${oldName}" RENAME TO "${newName}";`;
    try {
        executeSql(sql);
        console.log("\x1b[32mdone\x1b[0m");
    } catch (err) {
        console.log("\x1b[31mfailed\x1b[0m");
        console.error(`    ${err.message}`);
    }
}

async function renameAction(target) {
    const tables = await getPublicTables();
    if (tables.length === 0) {
        console.log("No public tables found in the database.\n");
        return;
    }

    if (!target) {
        console.log("\nAvailable public tables:\n");
        for (let i = 0; i < tables.length; i++) {
            const isOld = tables[i].startsWith("old_");
            const tag = isOld ? "\x1b[33m[OLD]\x1b[0m" : "\x1b[32m[CURRENT]\x1b[0m";
            console.log(`  ${String(i + 1).padStart(2, " ")}) ${tag} ${tables[i]}`);
        }
        const answer = await ask("\nEnter table name, number, or 'all' to rename (or 'q' to cancel): ");
        if (!answer || answer.toLowerCase() === "q") {
            console.log("Cancelled.\n");
            return;
        }
        return renameAction(answer);
    }

    let toRename = [];
    if (target.toLowerCase() === "all" || target === "--all") {
        toRename = tables.filter((t) => !t.startsWith("old_"));
        if (toRename.length === 0) {
            console.log("All tables already have the 'old_' prefix.\n");
            return;
        }
        const confirm = await ask(`Are you sure you want to rename ${toRename.length} table(s) by attaching 'old_'? (y/N): `);
        if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
            console.log("Aborted.\n");
            return;
        }
    } else {
        const num = parseInt(target, 10);
        let selected = null;
        if (!isNaN(num) && num >= 1 && num <= tables.length) {
            selected = tables[num - 1];
        } else {
            selected = tables.find((t) => t.toLowerCase() === target.toLowerCase());
        }
        if (!selected) {
            console.error(`\x1b[31mError:\x1b[0m Public table '${target}' not found.\n`);
            process.exit(1);
        }
        toRename = [selected];
    }

    console.log(`\nRenaming ${toRename.length} table(s) in database...\n`);
    for (const t of toRename) {
        await renameTable(t);
    }
    console.log("\nFinished.\n");
}

function printHelp() {
    console.log(`
MHMW Public Tables Management

Usage: node script/tables.mjs <action> [options]

Actions:
  list                 List all public tables from SUPABASE_URL
  rename [table|all]   Rename public table(s) by attaching 'old_'
  help                 Show this help screen

Examples:
  node script/tables.mjs list
  node script/tables.mjs rename waitlist_entries
  node script/tables.mjs rename all
  node script/tables.mjs rename
`);
}

async function main() {
    const rawArgs = process.argv.slice(2);
    const action = rawArgs[0] || "list";
    const target = rawArgs[1];

    if (action === "help" || action === "--help" || action === "-h") {
        printHelp();
        return;
    }
    if (action === "list") {
        await listAction();
    } else if (action === "rename") {
        await renameAction(target);
    } else {
        console.error(`Unknown action: '${action}'`);
        printHelp();
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`);
    process.exit(1);
});
