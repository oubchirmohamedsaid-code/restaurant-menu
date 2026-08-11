import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.OGT_DATA_DIR = join(tmpdir(), "ogt-tests", `stock-${Date.now()}`);

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const db = await import("../../lib/db");
  const stock = await import("../../lib/stock");

  // --- Item creation + validation ---
  const tomato = await db.createStockItem({
    name: "طماطم",
    type: "raw",
    unit: "kg",
    minQuantity: 5,
    unitCostCents: 300,
    supplier: "سوق الجملة",
  });
  assert.equal(tomato.quantity, 0, "new item starts at zero");
  assert.equal(tomato.unit, "kg", "unit persisted");

  await assert.rejects(() => db.createStockItem({ name: "x", type: "nope" as never, unit: "kg" }), /نوع/, "bad type rejected");
  await assert.rejects(() => db.createStockItem({ name: "x", type: "raw", unit: "meter" as never }), /وحدة/, "bad unit rejected");
  await assert.rejects(() => db.createStockItem({ name: "", type: "raw", unit: "kg" }), /اسم/, "empty name rejected");
  await assert.rejects(
    () => db.createStockItem({ name: "x", type: "raw", unit: "kg", minQuantity: -1 }),
    /الحد الأدنى/,
    "negative min rejected",
  );

  const cheese = await db.createStockItem({ name: "جبن", type: "raw", unit: "kg", minQuantity: 2, unitCostCents: 1200 });
  const box = await db.createStockItem({ name: "علب تغليف", type: "packaging", unit: "piece", minQuantity: 50, unitCostCents: 25 });

  // --- In movement ---
  const inMove = await db.addStockMovement({
    itemId: tomato.id,
    kind: "in",
    quantity: 50,
    supplier: "مورد الشمال",
    invoice: "INV-001",
    actor: { id: 1, username: "tester" },
  });
  assert.equal(inMove.kind, "in", "kind recorded");
  assert.equal(inMove.quantity, 50, "delta positive");
  assert.equal(inMove.prevQuantity, 0, "prev qty");
  assert.equal(inMove.newQuantity, 50, "new qty");
  assert.equal(inMove.supplier, "مورد الشمال", "supplier recorded");
  assert.equal(inMove.invoice, "INV-001", "invoice recorded");
  assert.equal((await db.getStockItem(tomato.id))!.quantity, 50, "item qty updated");

  // --- Out movement + reason requirement + max check ---
  await assert.rejects(
    () => db.addStockMovement({ itemId: tomato.id, kind: "out", quantity: 5 }),
    /السبب/,
    "out requires reason",
  );
  const outMove = await db.addStockMovement({
    itemId: tomato.id,
    kind: "out",
    quantity: 20,
    reason: "استهلاك المطبخ",
    actor: { id: 1, username: "tester" },
  });
  assert.equal(outMove.quantity, -20, "out delta negative");
  assert.equal((await db.getStockItem(tomato.id))!.quantity, 30, "out reduces qty");
  await assert.rejects(
    () => db.addStockMovement({ itemId: tomato.id, kind: "out", quantity: 100, reason: "كثير" }),
    /متاحة/,
    "out cannot exceed available",
  );

  // --- Adjust with mandatory reason ---
  await assert.rejects(
    () => db.addStockMovement({ itemId: tomato.id, kind: "adjust", newQuantity: 40 }),
    /السبب/,
    "adjust requires reason",
  );
  await db.addStockMovement({ itemId: tomato.id, kind: "adjust", newQuantity: 40, reason: "تصحيح خطأ" });
  assert.equal((await db.getStockItem(tomato.id))!.quantity, 40, "adjust down works");

  // --- Count: actual quantity, diff computed, reason mandatory ---
  await assert.rejects(
    () => db.addStockMovement({ itemId: tomato.id, kind: "count", actualQuantity: 35 }),
    /السبب/,
    "count requires reason",
  );
  const countMove = await db.addStockMovement({ itemId: tomato.id, kind: "count", actualQuantity: 35, reason: "جرد شهري" });
  assert.equal(countMove.quantity, -5, "count computes diff");
  assert.equal(countMove.newQuantity, 35, "count sets actual qty");

  // --- Status derivation (available/low/out) ---
  const water = await db.createStockItem({ name: "مياه", type: "raw", unit: "L", minQuantity: 10 });
  await db.addStockMovement({ itemId: water.id, kind: "in", quantity: 5, note: "شحنة" });
  assert.equal(stock.stockItemStatus({ quantity: 5, minQuantity: 10 }), "low", "below min is low");
  assert.equal(stock.stockItemStatus({ quantity: 0, minQuantity: 10 }), "out", "zero is out");
  assert.equal(stock.stockItemStatus({ quantity: 12, minQuantity: 10 }), "available", "above min is available");
  assert.equal(stock.stockItemStatus({ quantity: 10, minQuantity: 10 }), "available", "equals min is available");

  // --- Filters ---
  const active = await db.listStockItems();
  assert.equal(active.length, 4, "all active items listed");
  const byType = await db.listStockItems({ type: "packaging" });
  assert.equal(byType.length, 1, "type filter");
  assert.equal(byType[0].id, box.id, "filter matches packaging");
  const bySearch = await db.listStockItems({ search: "طما" });
  assert.equal(bySearch.length, 1, "search filter");
  assert.equal(bySearch[0].id, tomato.id, "search matches name");

  await db.archiveStockItem(box.id);
  assert.equal((await db.listStockItems()).length, 3, "archived hidden from active");
  assert.equal((await db.listStockItems({ archived: 1 })).length, 1, "archived shown with filter");

  // --- Movement filters ---
  const ins = await db.listStockMovements({ kind: "in" });
  assert.ok(ins.rows.length >= 2, "kind filter returns ins");
  const byItem = await db.listStockMovements({ itemId: tomato.id });
  assert.ok(byItem.rows.every((r) => r.itemId === tomato.id), "item filter");
  const byInvoice = await db.listStockMovements({ search: "INV-001" });
  assert.ok(byInvoice.rows.length >= 1, "search hits invoice");
  assert.equal(byInvoice.rows[0].itemName, "طماطم", "movement joins item name");

  // --- Summary + value + reorder ---
  const sum = await db.getStockSummary();
  assert.equal(sum.totalItems, 3, "summary counts active items");
  assert.ok(sum.lowItems >= 1, "water is low in summary");
  assert.ok(sum.reorderItems.some((r) => r.name === "مياه"), "water in reorder list");
  const tomatoValue = 35 * 300;
  assert.ok(sum.stockValueCents >= tomatoValue, "stock value sums qty × unit cost");

  // --- Product → ingredients ---
  const cat = await db.createCategory({ slug: "test-stock", nameAr: "اختبار", icon: "🍽️", imageUrl: "", sortOrder: 0 });
  const productId = await db.createProduct({
    categoryId: cat,
    name: "بيتزا مارغريتا",
    description: "",
    priceCents: 5000,
    imageUrl: "",
    isAvailable: 1,
  });
  await db.setProductIngredients(productId, [
    { itemId: tomato.id, qty: 0.5 },
    { itemId: cheese.id, qty: 0.2 },
  ]);
  const rec = await db.productIngredients(productId);
  assert.equal(rec.length, 2, "ingredients saved");
  await assert.rejects(
    () => db.setProductIngredients(productId, [{ itemId: tomato.id, qty: 1 }, { itemId: tomato.id, qty: 2 }]),
    /تكرار/,
    "duplicate ingredient rejected",
  );
  await assert.rejects(
    () => db.setProductIngredients(productId, [{ itemId: tomato.id, qty: 0 }]),
    /أكبر/,
    "zero qty ingredient rejected",
  );
  await assert.rejects(
    () => db.setProductIngredients(productId, [{ itemId: 999999, qty: 1 }]),
    /غير موجود/,
    "unknown ingredient rejected",
  );

  // --- Auto deduction on completion ---
  const orderId = await db.createOrder(
    [{ productId, name: "بيتزا مارغريتا", qty: 2, unitCents: 5000, extras: [], removed: [] }],
    10000,
    { actor: "tester" },
  );
  const tomatoBefore = (await db.getStockItem(tomato.id))!.quantity;
  const cheeseBefore = (await db.getStockItem(cheese.id))!.quantity;
  await db.updateOrderStatus(orderId, "completed", { actor: "tester" });
  assert.equal((await db.getStockItem(tomato.id))!.quantity, tomatoBefore - 1, "tomato deducted (2 × 0.5)");
  assert.equal((await db.getStockItem(cheese.id))!.quantity, cheeseBefore - 0.4, "cheese deducted (2 × 0.2)");
  const sales = await db.listStockMovements({ itemId: tomato.id, kind: "sale" });
  assert.ok(sales.rows.length >= 1, "sale movement recorded");
  const sale = sales.rows[0];
  assert.equal(sale.refType, "order", "sale ref type");
  assert.equal(sale.refId, orderId, "sale ref id");
  assert.equal(await db.deductStockForOrder(orderId), 0, "deduction is idempotent");

  // --- Restore on cancel of completed order ---
  await db.updateOrderStatus(orderId, "cancelled", { actor: "tester" });
  assert.equal((await db.getStockItem(tomato.id))!.quantity, tomatoBefore, "tomato restored");
  assert.equal((await db.getStockItem(cheese.id))!.quantity, cheeseBefore, "cheese restored");
  const restores = await db.listStockMovements({ itemId: tomato.id, kind: "restore" });
  assert.ok(restores.rows.some((r) => r.refId === orderId), "restore movement references order");
  assert.equal(await db.restoreStockForOrder(orderId), 0, "restore is idempotent");

  await db.updateOrderStatus(orderId, "completed", { actor: "tester" });
  assert.equal((await db.getStockItem(tomato.id))!.quantity, tomatoBefore - 1, "re-complete re-deducts after restore");
  await db.updateOrderStatus(orderId, "cancelled", { actor: "tester" });
  assert.equal((await db.getStockItem(tomato.id))!.quantity, tomatoBefore, "re-cancel restores again");

  // --- Restore on deleteOrder ---
  const order2 = await db.createOrder(
    [{ productId, name: "بيتزا مارغريتا", qty: 1, unitCents: 5000, extras: [], removed: [] }],
    5000,
    { actor: "tester" },
  );
  await db.updateOrderStatus(order2, "completed", { actor: "tester" });
  const afterDeduct = (await db.getStockItem(tomato.id))!.quantity;
  assert.equal(afterDeduct, tomatoBefore - 0.5, "second order deducted 0.5");
  await db.deleteOrder(order2);
  assert.equal((await db.getStockItem(tomato.id))!.quantity, tomatoBefore, "deleteOrder restores stock");

  // --- Unavailable product warning ---
  await db.addStockMovement({ itemId: cheese.id, kind: "in", quantity: 2, note: "شحنة" });
  await db.addStockMovement({ itemId: cheese.id, kind: "out", quantity: 2, reason: "نفاد مقصود" });
  const views = await db.listProductIngredients();
  const pizza = views.find((v) => v.productId === productId)!;
  assert.ok(pizza, "product view exists");
  assert.equal(pizza.hasRecipes, true, "product has recipes");
  assert.equal(pizza.unavailable, true, "product flagged unavailable when ingredient out");
  const cheeseIng = pizza.items.find((i) => i.itemId === cheese.id)!;
  assert.equal(cheeseIng.status, "out", "ingredient status out");

  console.log("test-stock: PASS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
