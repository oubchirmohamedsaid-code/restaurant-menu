import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads environment variables from desktop/.env first, then from the
 * repository root .env (shared with the web app). No secret is ever
 * hard-coded in source; TURSO_URL/TURSO_TOKEN come from the same .env
 * the Next.js app uses.
 */
export function loadEnv(cwd: string): void {
  const candidates = [join(cwd, ".env"), join(cwd, "..", ".env")];
  for (const file of candidates) {
    if (existsSync(file)) {
      try {
        process.loadEnvFile(file);
      } catch {
        // ignore unreadable env files
      }
    }
  }
}
