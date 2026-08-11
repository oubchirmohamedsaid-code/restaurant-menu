import { appendFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = ORDER[(process.env.LOG_LEVEL as Level) || "info"] ?? 20;

function logsDir(): string {
  return join(process.env.OGT_DATA_DIR ?? process.cwd(), "logs");
}

function logFile(): string {
  return join(logsDir(), "app.log");
}

let fileLogging = true;
try {
  mkdirSync(logsDir(), { recursive: true });
} catch {
  // read-only filesystem (e.g. Vercel serverless): fall back to stdout
  fileLogging = false;
}

function write(level: Level, msg: string, meta?: unknown) {
  if (ORDER[level] < MIN) return;
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta === undefined ? {} : { meta }),
  });
  if (fileLogging) {
    try {
      mkdirSync(logsDir(), { recursive: true });
    } catch {
      // fall back to stdout if the log directory is not writable
      if (level === "error") console.error(line);
      else console.log(line);
      return;
    }
    void appendFile(logFile(), line + "\n").catch(() => {});
  } else {
    if (level === "error") console.error(line);
    else console.log(line);
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => write("debug", msg, meta),
  info: (msg: string, meta?: unknown) => write("info", msg, meta),
  warn: (msg: string, meta?: unknown) => write("warn", msg, meta),
  error: (msg: string, meta?: unknown) => write("error", msg, meta),
};
