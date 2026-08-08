import { appendFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = ORDER[(process.env.LOG_LEVEL as Level) || "info"] ?? 20;
const FILE = join(process.cwd(), "logs", "app.log");

mkdirSync(join(process.cwd(), "logs"), { recursive: true });

function write(level: Level, msg: string, meta?: unknown) {
  if (ORDER[level] < MIN) return;
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta === undefined ? {} : { meta }),
  });
  void appendFile(FILE, line + "\n").catch(() => {});
}

export const logger = {
  debug: (msg: string, meta?: unknown) => write("debug", msg, meta),
  info: (msg: string, meta?: unknown) => write("info", msg, meta),
  warn: (msg: string, meta?: unknown) => write("warn", msg, meta),
  error: (msg: string, meta?: unknown) => write("error", msg, meta),
};
