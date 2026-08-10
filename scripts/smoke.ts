import assert from "node:assert";
import "dotenv/config";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  countAll,
  createCategory,
  createIngredient,
  createOrder,
  createProduct,
  deleteCategory,
  deleteIngredient,
  deleteOrder,
  deleteProduct,
  getCategoryBySlug,
  getOrder,
  getProductById,
  getSetting,
  hideUnavailableProducts,
  listCategories,
  listIngredientsByProduct,
  listOrders,
  listProductsByCategory,
  reorderCategories,
  setOrderPaymentStatus,
  setOrderPriority,
  setSetting,
  showHiddenProducts,
  updateCategory,
  updateCategoryImage,
  updateIngredient,
  updateOrderStatus,
  updateProduct,
} from "../lib/db";
import {
  CANCEL_REASONS,
  DEFAULT_LATE_MINUTES,
  isLate,
  minutesInStage,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "../lib/orders";
import {
  cartCount,
  cartTotalCents,
  formatOrderLine,
  flyVector,
  FLY_TARGET_OPACITY,
  FLY_PREP_SCALE,
  FLY_PREP_TRANSITION,
  FLY_LAUNCH_TRANSITION,
} from "../lib/cart";
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

  // --- cleanup leftovers from aborted runs ---
  for (const leftover of await listCategories()) {
    if (leftover.slug.startsWith("smoke-cat-")) await deleteCategory(leftover.id);
  }
  console.log("✓ leftover smoke categories cleaned");

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

  // --- category CRUD + hide/show + reorder (non-destructive: restores order) ---
  const origOrder = (await listCategories()).map((c) => c.id);
  const tempSlug = `smoke-cat-${Date.now()}`;
  await createCategory({
    slug: tempSlug,
    nameAr: "صنف اختبار تلقائي",
    icon: "🧪",
    imageUrl: "",
    sortOrder: 9999,
  });
  const tempCat = await getCategoryBySlug(tempSlug);
  assert.ok(tempCat, "created category must be readable by slug");
  assert.strictEqual(tempCat.nameAr, "صنف اختبار تلقائي");

  await updateCategory(tempCat.id, { nameAr: "صنف اختبار معدّل", isHidden: 1 });
  const renamed = await getCategoryBySlug(tempSlug);
  assert.ok(renamed, "renamed category must still be found by slug");
  assert.strictEqual(renamed.nameAr, "صنف اختبار معدّل");
  assert.strictEqual(renamed.isHidden, 1, "category must become hidden");
  await updateCategory(tempCat.id, { nameAr: "صنف اختبار معدّل", isHidden: 0 });
  assert.strictEqual(
    (await getCategoryBySlug(tempSlug))!.isHidden,
    0,
    "category must be visible again",
  );

  await reorderCategories([tempCat.id, ...origOrder]);
  assert.strictEqual(
    (await listCategories())[0].id,
    tempCat.id,
    "reorder must move temp category to the front",
  );
  await reorderCategories([...origOrder, tempCat.id]);
  assert.deepStrictEqual(
    (await listCategories()).slice(0, origOrder.length).map((c) => c.id),
    origOrder,
    "reorder must restore original order",
  );

  const tempProductId = await createProduct({
    categoryId: tempCat.id,
    name: "طبق في صنف اختبار",
    description: "للتحقق من الحذف المتسلسل",
    priceCents: 500,
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
    isAvailable: 1,
  });
  await deleteCategory(tempCat.id);
  assert.strictEqual(
    (await getCategoryBySlug(tempSlug)),
    undefined,
    "deleted category must be gone",
  );
  assert.strictEqual(
    (await listProductsByCategory(tempCat.id)).length,
    0,
    "cascade delete must remove the category's products",
  );
  assert.strictEqual(
    (await getProductById(tempProductId)),
    undefined,
    "cascade delete must remove the temp product",
  );
  assert.strictEqual(
    (await listCategories()).length,
    origOrder.length,
    "category count must be restored after delete",
  );
  console.log("✓ category CRUD + hide/show + reorder + cascade delete verified");

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

  // --- hide/show products (non-destructive: restores prior hidden state) ---
  const origHiddenIds = (await listProductsByCategory(pizza.id))
    .filter((p) => p.isHidden === 1)
    .map((p) => p.id);
  const hiddenCount = await hideUnavailableProducts(pizza.id);
  assert.ok(hiddenCount >= 1, "bulk hide must mark at least the unavailable test product");
  assert.strictEqual(
    (await getProductById(created.id))!.isHidden,
    1,
    "unavailable product must become hidden",
  );
  const nowHiddenIds = (await listProductsByCategory(pizza.id))
    .filter((p) => p.isHidden === 1)
    .map((p) => p.id);
  const toRestore = nowHiddenIds.filter((id) => !origHiddenIds.includes(id));
  const shownCount = await showHiddenProducts(pizza.id, toRestore);
  assert.strictEqual(
    shownCount,
    toRestore.length,
    "restore must unhide exactly the newly hidden products",
  );
  assert.strictEqual(
    (await getProductById(created.id))!.isHidden,
    0,
    "product must be visible again",
  );
  console.log("✓ hide/show products (isHidden) verified");

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

  // --- fly-to-cart animation vector (M17) ---
  const rectFrom = { x: 40, y: 120, width: 200, height: 150 };
  const rectTo = { x: 900, y: 20, width: 48, height: 48 };
  const v = flyVector(rectFrom, rectTo);
  assert.strictEqual(
    v.dx,
    rectTo.x + rectTo.width / 2 - (rectFrom.x + rectFrom.width / 2),
    "flyVector dx must aim at the target center",
  );
  assert.strictEqual(
    v.dy,
    rectTo.y + rectTo.height / 2 - (rectFrom.y + rectFrom.height / 2),
    "flyVector dy must aim at the target center",
  );
  const zero = flyVector(
    { x: 0, y: 0, width: 10, height: 10 },
    { x: 0, y: 0, width: 10, height: 10 },
  );
  assert.deepStrictEqual(zero, { dx: 0, dy: 0 }, "aligned centers must produce a zero offset");
  console.log("✓ fly-to-cart animation vector verified");

  // --- fly animation config: opaque + 50%-shrink prep then arc launch (M20) ---
  assert.strictEqual(
    FLY_TARGET_OPACITY,
    1,
    "flying image must stay fully opaque so the path to the cart is clear",
  );
  assert.strictEqual(
    FLY_PREP_SCALE,
    0.5,
    "prep phase must shrink the image to 50% instead of rising upward",
  );
  assert.ok(
    FLY_LAUNCH_TRANSITION.x.duration < FLY_PREP_TRANSITION.duration,
    "launch toward the cart must be faster than the slow prep shrink",
  );
  assert.notDeepStrictEqual(
    FLY_LAUNCH_TRANSITION.x.ease,
    FLY_LAUNCH_TRANSITION.y.ease,
    "horizontal and vertical launch easing must differ to produce a curved arc",
  );
  console.log("✓ fly animation config: opaque + 50%-shrink prep then arc launch verified");

  // --- order lifecycle: pipeline + activity + settings (M21) ---
  assert.strictEqual(STATUS_LABELS.new, "طلب جديد", "status labels must be in Arabic");
  assert.strictEqual(STATUS_LABELS.cancelled, "ملغى", "cancelled label must exist");
  assert.strictEqual(PRIORITY_LABELS.urgent, "عاجل", "priority labels must be in Arabic");
  assert.strictEqual(CANCEL_REASONS.length, 6, "six optional cancel reasons");
  assert.strictEqual(DEFAULT_LATE_MINUTES.preparing, 30, "default late threshold for preparing");

  const orderId = await createOrder(
    [
      { productId: 1, name: "بيتزا", qty: 2, unitCents: 2800, extras: ["جبنة"], removed: [] },
      { productId: 2, name: "عصير", qty: 1, unitCents: 2000, extras: [], removed: ["ثلج"] },
    ],
    7600,
  );
  let detail = await getOrder(orderId);
  assert.ok(detail, "order must be fetchable with details");
  assert.strictEqual(detail.order.status, "new", "new order starts as 'new'");
  assert.strictEqual(detail.order.priority, "normal", "default priority is normal");
  assert.strictEqual(detail.order.paymentStatus, "unpaid", "default payment status is unpaid");
  assert.strictEqual(detail.lines.length, 2, "structured order lines must be stored");
  assert.strictEqual(detail.lines[0].lineCents, 5600, "line cents = unit x qty");
  assert.strictEqual(detail.activity[0].action, "created", "creation must be logged");
  assert.ok(detail.order.updatedAt >= detail.order.createdAt, "updatedAt must be set");
  assert.ok(detail.order.items.includes("بيتزا"), "display items JSON still stored");

  await updateOrderStatus(orderId, "preparing", { actor: "admin" });
  detail = (await getOrder(orderId))!;
  assert.ok(detail.order.preparingAt && detail.order.confirmedAt, "confirm records prep + confirm timestamps");
  assert.strictEqual(detail.order.preparingAt, detail.order.confirmedAt, "confirm starts preparing");
  assert.ok(detail.activity.some((a) => a.action === "confirmed"), "confirmation logged");
  assert.ok(detail.activity.some((a) => a.action === "preparing"), "preparing logged");

  await updateOrderStatus(orderId, "delivered", { actor: "admin" });
  detail = (await getOrder(orderId))!;
  assert.ok(detail.order.deliveredAt, "delivery records timestamp");

  await updateOrderStatus(orderId, "completed", { actor: "admin" });
  detail = (await getOrder(orderId))!;
  assert.ok(detail.order.completedAt, "completion records timestamp");
  assert.ok(detail.activity.some((a) => a.action === "completed"), "completion logged");

  await setOrderPriority(orderId, "urgent", "admin");
  detail = (await getOrder(orderId))!;
  assert.strictEqual(detail.order.priority, "urgent", "priority must update");

  await setOrderPaymentStatus(orderId, "paid", "admin");
  detail = (await getOrder(orderId))!;
  assert.strictEqual(detail.order.paymentStatus, "paid", "payment status must update");

  const cancelId = await createOrder(
    [{ productId: 1, name: "بيتزا", qty: 1, unitCents: 2800, extras: [], removed: [] }],
    2800,
  );
  await updateOrderStatus(cancelId, "cancelled", { actor: "admin", reason: "الزبون ألغى الطلب" });
  const cancelled = (await getOrder(cancelId))!;
  assert.strictEqual(cancelled.order.status, "cancelled", "cancelled order stays stored");
  assert.strictEqual(cancelled.order.cancelReason, "الزبون ألغى الطلب", "cancel reason recorded");
  assert.ok(cancelled.activity.some((a) => a.action === "cancelled"), "cancellation logged");

  const prepAt = Date.now() - 31 * 60 * 1000;
  assert.strictEqual(
    minutesInStage({ status: "preparing", createdAt: 0, preparingAt: prepAt, deliveredAt: null }, Date.now()),
    31,
    "minutes in stage = now - stage start",
  );
  assert.strictEqual(
    minutesInStage({ status: "completed", createdAt: 0, preparingAt: prepAt, deliveredAt: null }, Date.now()),
    null,
    "terminal status has no stage time",
  );
  assert.strictEqual(
    isLate({ status: "preparing", createdAt: 0, preparingAt: prepAt, deliveredAt: null }, {}, Date.now()),
    true,
    "preparing 31 min > default 30 = late",
  );
  assert.strictEqual(
    isLate({ status: "preparing", createdAt: 0, preparingAt: Date.now() - 10 * 60 * 1000, deliveredAt: null }, {}, Date.now()),
    false,
    "preparing 10 min < 30 = not late",
  );

  await setSetting("late_preparing_minutes", "45");
  assert.strictEqual(await getSetting("late_preparing_minutes"), "45", "settings value must persist");
  assert.strictEqual(await getSetting("late_new_minutes"), "15", "late thresholds seeded by default");
  await setSetting("late_preparing_minutes", "30");

  await deleteOrder(orderId);
  await deleteOrder(cancelId);
  assert.strictEqual((await listOrders()).find((o) => o.id === orderId), undefined, "deleted order must be gone");
  assert.strictEqual(await getOrder(orderId), undefined, "deleted order detail must be gone");
  console.log("✓ order lifecycle: pipeline + activity + settings verified");

  // --- image upload helper ---
  const upload = await saveImageUpload(Buffer.from("fakepng"), "pic.png");
  assert.ok("path" in upload && upload.path.startsWith("/uploads/"), "upload must return a /uploads path");
  assert.ok(existsSync(join(process.cwd(), "public", upload.path)), "uploaded file must exist on disk");
  unlinkSync(join(process.cwd(), "public", upload.path));
  const badExt = await saveImageUpload(Buffer.from("x"), "doc.exe");
  assert.ok("error" in badExt, "unsupported extension must be rejected");
  const badSize = await saveImageUpload(new Uint8Array(5 * 1024 * 1024), "big.jpg");
  assert.ok("error" in badSize, "oversized file must be rejected");
  console.log("✓ image upload helper verified");

  console.log("SMOKE OK");
}

main();
