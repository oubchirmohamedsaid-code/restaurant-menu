import assert from "node:assert";
import "dotenv/config";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  countAll,
  createIngredient,
  createOrder,
  createProduct,
  deleteIngredient,
  deleteOrder,
  deleteProduct,
  getCategoryBySlug,
  getProductById,
  listCategories,
  listIngredientsByProduct,
  listOrders,
  listProductsByCategory,
  updateCategoryImage,
  updateIngredient,
  updateProduct,
} from "../lib/db";
import { cartCount, cartTotalCents, formatOrderLine } from "../lib/cart";
import type { CartLine } from "../lib/cart";
import { createSessionToken, verifyPassword, verifySessionToken } from "../lib/session";
import { formatPrice } from "../lib/utils";
import { saveImageUpload } from "../lib/upload";

async function main() {
  // --- auth ---
  assert.strictEqual(verifyPassword("wrong-password"), false, "wrong password must be rejected");
  assert.strictEqual(verifyPassword("admin123"), true, "correct password must be accepted");
  const token = createSessionToken();
  assert.strictEqual(verifySessionToken(token), true, "fresh token must verify");
  assert.strictEqual(verifySessionToken(undefined), false, "missing token must fail");
  assert.strictEqual(verifySessionToken("tampered.token"), false, "tampered token must fail");
  console.log("✓ auth password + session verified");

  // --- seed + currency + category images ---
  const cats = await listCategories();
  assert.strictEqual(cats.length, 4, "expected 4 seeded categories");
  assert.strictEqual((await countAll()).categories, 4);
  assert.ok((await countAll()).products >= 4, "expected seeded products present (count drifts via admin)");
  cats.forEach((c) => {
    assert.ok(
      typeof c.imageUrl === "string" && c.imageUrl.length > 0,
      `category ${c.slug} must have an imageUrl`,
    );
  });
  const currency = formatPrice(1000);
  assert.ok(currency.includes("دج"), `formatPrice must use Algerian Dinar, got: ${currency}`);
  console.log("✓ seed data present + category imageUrl + currency دج");

  // --- category image edit ---
  const pizza = await getCategoryBySlug("pizza");
  assert.ok(pizza, "pizza category must exist");
  const originalPizzaImage = pizza.imageUrl;
  await updateCategoryImage(pizza.id, "https://images.unsplash.com/photo-1574071318508-1cdbab80d002");
  assert.strictEqual(
    (await getCategoryBySlug("pizza"))!.imageUrl,
    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002",
    "category image must be updated",
  );
  await updateCategoryImage(pizza.id, originalPizzaImage);
  console.log("✓ category image update verified");

  // --- product CRUD ---
  const before = await listProductsByCategory(pizza.id);
  await createProduct({
    categoryId: pizza.id,
    name: "طبق اختبار تلقائي",
    description: "إنشاء من اختبار",
    priceCents: 999,
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591",
    isAvailable: 1,
  });
  const created = (await listProductsByCategory(pizza.id)).find((p) => p.name === "طبق اختبار تلقائي");
  assert.ok(created, "created product must be readable");

  // --- ingredient CRUD ---
  const cheeseId = await createIngredient(created.id, "جبنة إضافية", 500, 1, 0);
  const onionId = await createIngredient(created.id, "بصل", 0, 0, 1);
  const ings = await listIngredientsByProduct(created.id);
  assert.strictEqual(ings.length, 2, "expected 2 ingredients after create");
  const cheese = ings.find((i) => i.id === cheeseId);
  assert.ok(cheese, "cheese ingredient must exist");
  assert.strictEqual(cheese.priceCents, 500);
  assert.strictEqual(cheese.isExtra, 1);
  assert.strictEqual(cheese.isRequired, 0, "extra must not be required");
  const onion = ings.find((i) => i.id === onionId);
  assert.ok(onion, "onion ingredient must exist");
  assert.strictEqual(onion.isRequired, 1, "required base ingredient flag must persist");
  await updateIngredient(onionId, "بصل مكرمل", 50, 0, 0);
  const onionAfter = (await listIngredientsByProduct(created.id)).find((i) => i.id === onionId);
  assert.strictEqual(onionAfter!.name, "بصل مكرمل", "ingredient must be updated");
  assert.strictEqual(onionAfter!.isRequired, 0, "isRequired must be updatable");
  await deleteIngredient(onionId);
  assert.strictEqual(
    (await listIngredientsByProduct(created.id)).length,
    1,
    "delete must remove the ingredient",
  );
  console.log("✓ ingredient CRUD (incl. isRequired) verified");

  await updateProduct(created.id, {
    categoryId: pizza.id,
    name: "طبق اختبار معدّل",
    description: "تعديل من اختبار",
    priceCents: 1234,
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
    isAvailable: 0,
  });
  const updated = await getProductById(created.id);
  assert.ok(updated, "updated product must exist");
  assert.strictEqual(updated.name, "طبق اختبار معدّل");
  assert.strictEqual(updated.priceCents, 1234);
  assert.strictEqual(updated.isAvailable, 0);
  console.log("✓ CRUD create/update verified");

  await deleteProduct(created.id);
  assert.strictEqual(
    (await listProductsByCategory(pizza.id)).length,
    before.length,
    "delete must restore product count",
  );
  console.log("✓ CRUD delete verified");

  // --- cart totals + order line formatting ---
  const lines: CartLine[] = [
    {
      productId: 1,
      key: "1",
      name: "بيتزا",
      priceCents: 2800,
      imageUrl: "",
      qty: 2,
      extras: [],
      removed: [],
    },
    {
      productId: 2,
      key: "2",
      name: "عصير",
      priceCents: 1500,
      imageUrl: "",
      qty: 1,
      extras: [{ id: 99, name: "جبنة", priceCents: 500 }],
      removed: [{ id: 5, name: "بصل" }],
    },
  ];
  assert.strictEqual(cartCount(lines), 3);
  assert.strictEqual(cartTotalCents(lines), 7100);
  const lineText = formatOrderLine({
    name: "عصير",
    qty: 1,
    priceCents: 1500,
    extras: ["جبنة"],
    removed: ["بصل"],
  });
  assert.ok(lineText.includes("عصير × 1"), "order line must include name and qty");
  assert.ok(lineText.includes("بدون: بصل"), "order line must include removed ingredients");
  assert.ok(lineText.includes("جبنة"), "order line must include added extras");
  console.log("✓ cart totals + order line formatting verified");

  // --- orders create/list/delete ---
  const orderId = await createOrder(JSON.stringify(["بيتزا × 2 — 56.00 دج"]), 6600);
  const orders = await listOrders();
  assert.ok(orders.length >= 1, "orders must be listed");
  const last = orders[0];
  assert.ok(last.items.includes("بيتزا"), "order items must be stored");
  assert.strictEqual(last.totalCents, 6600);
  await deleteOrder(orderId);
  assert.strictEqual(
    (await listOrders()).find((o) => o.id === orderId),
    undefined,
    "deleted order must be gone",
  );
  console.log("✓ orders create/list/delete verified");

  // --- image upload helper ---
  const upload = saveImageUpload(Buffer.from("fakepng"), "pic.png");
  assert.ok("path" in upload && upload.path.startsWith("/uploads/"), "upload must return a /uploads path");
  assert.ok(existsSync(join(process.cwd(), "public", upload.path)), "uploaded file must exist on disk");
  unlinkSync(join(process.cwd(), "public", upload.path));
  const badExt = saveImageUpload(Buffer.from("x"), "doc.exe");
  assert.ok("error" in badExt, "unsupported extension must be rejected");
  const badSize = saveImageUpload(new Uint8Array(5 * 1024 * 1024), "big.jpg");
  assert.ok("error" in badSize, "oversized file must be rejected");
  console.log("✓ image upload helper verified");

  console.log("SMOKE OK");
}

main();
