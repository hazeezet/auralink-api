import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import fs from "node:fs";
import path from "node:path";

const isProduction = process.env.NODE_ENV === "production";
const logDir = path.resolve(process.cwd(), process.env.LOG_DIR || "logs");

if (!fs.existsSync(logDir)) {
    try {
        fs.mkdirSync(logDir, { recursive: true });
    } catch {
        // Fall back gracefully if filesystem is read-only
    }
}

const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
    }),
);

const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
);

// Determine log targets: "file" by default, configurable via LOG_TARGET or LOG_TRANSPORTS
// Supported values: "file" (default), "console", "both", "file,console"
const rawTarget = (process.env.LOG_TARGET || process.env.LOG_TRANSPORTS || "file").toLowerCase().trim();
const enableFile = rawTarget.includes("file") || rawTarget.includes("both") || rawTarget === "";
const enableConsole = rawTarget.includes("console") || rawTarget.includes("both");

const transports: winston.transport[] = [];

if (enableConsole) {
    transports.push(
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.LOG_LEVEL || "info",
        }),
    );
}

if (enableFile && fs.existsSync(logDir)) {
    // Daily rotated application log
    transports.push(
        new DailyRotateFile({
            dirname: logDir,
            filename: "application-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            zippedArchive: false,
            maxSize: "20m",
            maxFiles: "14d",
            format: fileFormat,
            level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
        }),
    );

    // Daily rotated error log
    transports.push(
        new DailyRotateFile({
            dirname: logDir,
            filename: "error-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            zippedArchive: false,
            maxSize: "20m",
            maxFiles: "30d",
            format: fileFormat,
            level: "error",
        }),
    );
}

// Ensure at least one transport exists so Winston never throws
if (transports.length === 0) {
    transports.push(
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.LOG_LEVEL || "info",
        }),
    );
}

export const appLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
    transports,
});

export default appLogger;
