"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, verifyPassword, verifySessionToken } from "@/lib/session";
import {
  createCategory,
  createIngredient,
  createOrder,
  createProduct,
  deleteCategory,
  deleteIngredient,
  deleteProduct,
  getCategoryById,
  getOrder,
  getProductById,
  hideUnavailableProducts,
  listCategories,
  listProductsByCategory,
  reorderCategories,
  setOrderPaymentStatus,
  setOrderPriority,
  showHiddenProducts,
  updateCategory,
  updateCategoryImage,
  updateIngredient,
  updateOrderStatus,
  updateProduct,
} from "@/lib/db";
import type { OrderDetail, OrderLineInput } from "@/lib/db";
import type { OrderPriority, PaymentStatus } from "@/lib/orders";
import { saveImageUpload, deleteStoredImage } from "@/lib/upload";
import { logger } from "@/lib/logger";

const SESSION_COOKIE = "admin_session";

const AR_TO_EN: Record<string, string> = {
  "المشروبات": "drinks",
  "البيتزا": "pizza",
  "البرجر": "burgers",
  "الحلويات": "desserts",
  "المقبلات": "starters",
  "السلطات": "salads",
  "الشاورما": "shawarma",
  "المأكولات البحرية": "seafood",
  "الأطباق الرئيسية": "mains",
  "المعجنات": "pastries",
  "الإفطار": "breakfast",
  "الغداء": "lunch",
  "العشاء": "dinner",
};

function makeCategorySlug(nameAr: string): string {
  const known = AR_TO_EN[nameAr.trim()];
  if (known) return known;
  return `category-${Date.now().toString(36)}`;
}

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
  count?: number;
  orderId?: number;
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
  if (raw.size === 0) return null;
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
  if (image && "path" in image && image.path !== existing.imageUrl) {
    await deleteStoredImage(existing.imageUrl);
  }
  logger.info("product updated", { id, name, priceCents });
  return { ok: true };
}

export async function deleteProductAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const id = Number(formData.get("id"));
  const existing = await getProductById(id);
  await deleteProduct(id);
  if (existing) await deleteStoredImage(existing.imageUrl);
  logger.info("product deleted", { id });
  return { ok: true };
}

export async function updateCategoryImageAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const id = Number(formData.get("id"));
  const existing = await getCategoryById(id);
  const image = await uploadImageField(formData);
  if (!image) return { error: "صورة الصنف مطلوبة" };
  if ("error" in image) return { error: image.error };
  await updateCategoryImage(id, image.path);
  if (existing && existing.imageUrl !== image.path) {
    await deleteStoredImage(existing.imageUrl);
  }
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

export async function confirmOrderAction(orderId: number): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  await updateOrderStatus(orderId, "preparing", { actor: "admin" });
  logger.info("order confirmed", { orderId });
  return { ok: true };
}

export async function markDeliveredAction(orderId: number): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  await updateOrderStatus(orderId, "delivered", { actor: "admin" });
  logger.info("order delivered", { orderId });
  return { ok: true };
}

export async function completeOrderAction(orderId: number): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  await updateOrderStatus(orderId, "completed", { actor: "admin" });
  logger.info("order completed", { orderId });
  return { ok: true };
}

export async function cancelOrderAction(orderId: number, reason: string): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  await updateOrderStatus(orderId, "cancelled", { actor: "admin", reason });
  logger.info("order cancelled", { orderId, reason });
  return { ok: true };
}

export async function setOrderPriorityAction(orderId: number, priority: OrderPriority): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  await setOrderPriority(orderId, priority);
  logger.info("order priority set", { orderId, priority });
  return { ok: true };
}

export async function setOrderPaymentStatusAction(orderId: number, paymentStatus: PaymentStatus): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  await setOrderPaymentStatus(orderId, paymentStatus);
  logger.info("order payment set", { orderId, paymentStatus });
  return { ok: true };
}

export async function getOrderDetailAction(orderId: number): Promise<OrderDetail | undefined> {
  if (!(await isAdmin())) redirect("/admin");
  return getOrder(orderId);
}

export async function reorderOrderAction(orderId: number): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const detail = await getOrder(orderId);
  if (!detail) return { error: "الطلب غير موجود" };
  const lines: OrderLineInput[] = detail.lines.map((l) => ({
    productId: l.productId,
    name: l.name,
    qty: l.qty,
    unitCents: l.unitCents,
    extras: parseJsonArray(l.extras),
    removed: parseJsonArray(l.removed),
  }));
  const newId = await createOrder(lines, detail.order.totalCents);
  logger.info("order reordered", { from: orderId, to: newId });
  return { ok: true, orderId: newId };
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function hideUnavailableProductsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const categoryId = Number(formData.get("categoryId"));
  if (!(await getCategoryById(categoryId))) return { error: "الصنف غير موجود" };
  const count = await hideUnavailableProducts(categoryId);
  logger.info("products hidden", { categoryId, count });
  return { ok: true, count };
}

export async function showHiddenProductsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const categoryId = Number(formData.get("categoryId"));
  if (!(await getCategoryById(categoryId))) return { error: "الصنف غير موجود" };
  const ids = formData
    .getAll("ids")
    .map((v) => Number(v))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return { error: "اختر منتجاً واحداً على الأقل" };
  const count = await showHiddenProducts(categoryId, ids);
  logger.info("products shown again", { categoryId, count });
  return { ok: true, count };
}

export async function createCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const icon = String(formData.get("icon") ?? "🍽️").trim() || "🍽️";
  const image = await uploadImageField(formData);
  if (!nameAr) return { error: "اسم الصنف مطلوب" };
  if (image && "error" in image) return { error: image.error };

  const categories = await listCategories();
  const sortOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sortOrder)) + 1 : 0;
  const slug = makeCategorySlug(nameAr);
  await createCategory({
    slug,
    nameAr,
    icon,
    imageUrl: image && "path" in image ? image.path : "",
    sortOrder,
  });
  logger.info("category created", { nameAr, slug });
  return { ok: true };
}

export async function updateCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const id = Number(formData.get("id"));
  const existing = await getCategoryById(id);
  if (!existing) return { error: "الصنف غير موجود" };

  const nameAr = String(formData.get("nameAr") ?? existing.nameAr).trim();
  const isHidden = parseBool(formData.get("isHidden"));
  const image = await uploadImageField(formData);
  if (!nameAr) return { error: "اسم الصنف مطلوب" };
  if (image && "error" in image) return { error: image.error };

  await updateCategory(id, { nameAr, isHidden });
  if (image && "path" in image && image.path !== existing.imageUrl) {
    await updateCategoryImage(id, image.path);
    if (existing.imageUrl) await deleteStoredImage(existing.imageUrl);
  }
  logger.info("category updated", { id, nameAr, isHidden });
  return { ok: true };
}

export async function deleteCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const id = Number(formData.get("id"));
  const existing = await getCategoryById(id);
  if (!existing) return { error: "الصنف غير موجود" };

  const products = await listProductsByCategory(id);
  await deleteCategory(id);
  for (const p of products) {
    if (p.imageUrl) await deleteStoredImage(p.imageUrl);
  }
  if (existing.imageUrl) await deleteStoredImage(existing.imageUrl);
  logger.info("category deleted", { id, products: products.length });
  redirect("/admin/dashboard");
}

export async function reorderCategoriesAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isAdmin())) redirect("/admin");
  const ids = formData
    .getAll("ids")
    .map((v) => Number(v))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return { error: "لا توجد أصناف لإعادة ترتيبها" };
  await reorderCategories(ids);
  logger.info("categories reordered", { ids });
  return { ok: true };
}
