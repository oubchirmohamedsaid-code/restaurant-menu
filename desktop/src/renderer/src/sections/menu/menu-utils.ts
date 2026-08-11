import type { OgtFlag } from "@shared/types";

export function toFlag(v: unknown): OgtFlag {
  return v === 1 || v === "1" || v === true ? 1 : 0;
}

export function priceInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function parsePriceInput(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function uploadFile(file: File | null): Promise<{ path: string } | { error: string }> {
  if (!file) return { error: "لم يتم اختيار ملف" };
  if (file.size === 0) return { error: "الملف فارغ" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return window.ogt.menu.uploadImage(bytes, file.name);
}

export function isRemoteImage(url: string): boolean {
  return /^https:\/\//i.test(url);
}

export function imagePreview(file: File | null): string {
  return file ? URL.createObjectURL(file) : "";
}
