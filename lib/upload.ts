import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { put, del } from "@vercel/blob";
import { logger } from "./logger";

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_BYTES = 4 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export type UploadResult = { path: string } | { error: string };

function isBlobUrl(url: string): boolean {
  return url.startsWith("http") && url.includes("blob.vercel-storage.com");
}

export async function saveImageUpload(
  bytes: Uint8Array,
  originalName: string,
): Promise<UploadResult> {
  const ext = extname(originalName).toLowerCase();
  if (!ALLOWED.has(ext)) {
    return { error: "صيغة الصورة غير مدعومة (jpg/png/webp/gif)" };
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return { error: "حجم الصورة كبير (الحد الأقصى 4MB)" };
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(`menu/${randomUUID()}${ext}`, Buffer.from(bytes), {
        access: "public",
        contentType: CONTENT_TYPES[ext],
      });
      logger.info("image uploaded to blob", { url: blob.url, bytes: bytes.byteLength });
      return { path: blob.url };
    } catch (e) {
      logger.error("blob upload failed", { message: (e as Error).message });
      return { error: "تعذر رفع الصورة إلى التخزين السحابي، حاول مجدداً" };
    }
  }
  try {
    mkdirSync(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    writeFileSync(join(UPLOAD_DIR, filename), Buffer.from(bytes));
    const path = `/uploads/${filename}`;
    logger.info("image uploaded", { filename, bytes: bytes.byteLength });
    return { path };
  } catch (e) {
    logger.error("local upload failed", { message: (e as Error).message });
    return { error: "تعذر حفظ الصورة على الخادم (نظام الملفات غير قابل للكتابة)" };
  }
}

export async function deleteStoredImage(url: string): Promise<void> {
  if (!url) return;
  try {
    if (isBlobUrl(url)) {
      await del(url);
      logger.info("blob image deleted", { url });
    } else if (url.startsWith("/uploads/")) {
      unlinkSync(join(process.cwd(), "public", url));
      logger.info("local image deleted", { url });
    }
  } catch (e) {
    logger.warn("image delete failed (ignored)", { url, message: (e as Error).message });
  }
}
