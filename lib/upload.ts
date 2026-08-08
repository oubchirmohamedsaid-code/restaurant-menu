import { mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_BYTES = 4 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

export type UploadResult = { path: string } | { error: string };

export function saveImageUpload(bytes: Uint8Array, originalName: string): UploadResult {
  const ext = extname(originalName).toLowerCase();
  if (!ALLOWED.has(ext)) {
    return { error: "صيغة الصورة غير مدعومة (jpg/png/webp/gif)" };
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return { error: "حجم الصورة كبير (الحد الأقصى 4MB)" };
  }
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  writeFileSync(join(UPLOAD_DIR, filename), Buffer.from(bytes));
  const path = `/uploads/${filename}`;
  logger.info("image uploaded", { filename, bytes: bytes.byteLength });
  return { path };
}
