"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, verifyPassword, verifySessionToken } from "@/lib/session";
import {
  createIngredient,
  createProduct,
  deleteIngredient,
  deleteOrder,
  deleteProduct,
  getCategoryById,
  getProductById,
  updateCategoryImage,
  updateIngredient,
  updateProduct,
} from "@/lib/db";
import { saveImageUpload } from "@/lib/upload";
import { logger } from "@/lib/logger";

const SESSION_COOKIE = "admin_session";

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

export async function loginAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password)) {
    logger.warn("admin login rejected");
    return { error: "كلمة المرور غير صحيحة" };
  }
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
  logger.info("admin logged in");
  redirect("/admin/dashboard");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/admin");
}

function parsePriceCents(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const n = Number(String(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseBool(raw: FormDataEntryValue | null): number {
  return raw === "on" ? 1 : 0;
}

async function uploadImageField(
  formData: FormData,
  field = "image",
): Promise<{ path: string } | { error: string } | null> {
  const raw = formData.get(field);
  if (!raw) return null;
  if (!(raw instanceof File)) return { error: "ملف الصورة غير صالح" };
  return saveImageUpload(new Uint8Array(await raw.arrayBuffer()), raw.name);
}

export async function createProductAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const categoryId = Number(formData.get("categoryId"));
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceCents = parsePriceCents(formData.get("price"));
  const isAvailable = parseBool(formData.get("isAvailable"));
  const image = await uploadImageField(formData);

  if (!(await getCategoryById(categoryId))) return { error: "الصنف غير موجود" };
  if (!name) return { error: "الاسم مطلوب" };
  if (priceCents === null) return { error: "السعر غير صالح" };
  if (!image) return { error: "صورة الطبق مطلوبة" };
  if ("error" in image) return { error: image.error };
  const imageUrl = image.path;

  await createProduct({ categoryId, name, description, priceCents, imageUrl, isAvailable });
  logger.info("product created", { categoryId, name, priceCents });
  return { ok: true };
}

export async function updateProductAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const id = Number(formData.get("id"));
  const categoryId = Number(formData.get("categoryId"));
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceCents = parsePriceCents(formData.get("price"));
  const isAvailable = parseBool(formData.get("isAvailable"));
  const existing = await getProductById(id);
  const image = await uploadImageField(formData);

  if (!existing) return { error: "الطبق غير موجود" };
  if (!name) return { error: "الاسم مطلوب" };
  if (priceCents === null) return { error: "السعر غير صالح" };
  if (image && "error" in image) return { error: image.error };
  const imageUrl = image && "path" in image ? image.path : existing.imageUrl;

  await updateProduct(id, { categoryId, name, description, priceCents, imageUrl, isAvailable });
  logger.info("product updated", { id, name, priceCents });
  return { ok: true };
}

export async function deleteProductAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const id = Number(formData.get("id"));
  await deleteProduct(id);
  logger.info("product deleted", { id });
  return { ok: true };
}

export async function updateCategoryImageAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const id = Number(formData.get("id"));
  const image = await uploadImageField(formData);
  if (!image) return { error: "صورة الصنف مطلوبة" };
  if ("error" in image) return { error: image.error };
  await updateCategoryImage(id, image.path);
  logger.info("category image updated", { id });
  return { ok: true };
}

export async function saveIngredientAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const rawId = formData.get("id");
  const productId = Number(formData.get("productId"));
  const name = String(formData.get("name") ?? "").trim();
  const priceCents = parsePriceCents(formData.get("price"));
  const isExtra = parseBool(formData.get("isExtra"));
  const isRequired = parseBool(formData.get("isRequired"));

  if (!name) return { error: "اسم المكون مطلوب" };
  if (priceCents === null) return { error: "السعر غير صالح" };

  if (rawId) {
    await updateIngredient(Number(rawId), name, priceCents, isExtra, isRequired);
  } else {
    await createIngredient(productId, name, priceCents, isExtra, isRequired);
  }
  logger.info("ingredient saved", { productId, name, priceCents, isExtra, isRequired });
  return { ok: true };
}

export async function deleteIngredientAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const id = Number(formData.get("id"));
  await deleteIngredient(id);
  logger.info("ingredient deleted", { id });
  return { ok: true };
}

export async function deleteOrderAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const id = Number(formData.get("id"));
  await deleteOrder(id);
  logger.info("order deleted", { id });
  return { ok: true };
}
