import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.OGT_DATA_DIR = join(tmpdir(), "ogt-tests", `cashbox-${Date.now()}`);

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const db = await import("../../lib/db");

  const id = await db.createOrder(
    [{ productId: 0, name: "بيتزا", qty: 1, unitCents: 2500, extras: [], removed: [] }],
    2500,
    { actor: "tester" },
  );

  assert.equal(await db.currentCashboxBalance(), 0, "unpaid order adds no income");
  assert.equal((await db.listCashboxTransactions()).total, 0, "no transactions before payment");

  await db.updateOrderStatus(id, "completed", { actor: "tester" });
  let tx = (await db.listCashboxTransactions()).rows;
  assert.equal(tx.length, 1, "one income recorded on completion");
  assert.equal(tx[0].type, "income", "income type");
  assert.equal(tx[0].source, "order", "order source");
  assert.equal(tx[0].orderId, id, "linked order id");
  assert.equal(tx[0].amountCents, 2500, "income equals order total");
  assert.equal(await db.currentCashboxBalance(), 2500, "balance equals income");

  await db.recordOrderIncome(id, "tester");
  tx = (await db.listCashboxTransactions()).rows;
  assert.equal(tx.filter((t) => t.type === "income").length, 1, "income is idempotent");

  await db.setOrderPaymentStatus(id, "unpaid", "tester");
  tx = (await db.listCashboxTransactions()).rows;
  assert.equal(tx.length, 2, "reversal added when unpaying");
  assert.equal(tx[0].type, "adjustment", "reversal type");
  assert.equal(tx[0].direction, "out", "reversal direction");
  assert.equal(tx[0].amountCents, 2500, "reversal amount");
  assert.equal(tx[0].correctsTxId, tx[1].id, "reversal references original");
  assert.equal(tx[1].status, "reversed", "original marked reversed");
  assert.equal(await db.currentCashboxBalance(), 0, "balance zero after reversal");

  await db.setOrderPaymentStatus(id, "paid", "tester");
  tx = (await db.listCashboxTransactions()).rows;
  assert.equal(tx.filter((t) => t.type === "income" && t.status === "active").length, 1, "re-pay creates active income");
  assert.equal(await db.currentCashboxBalance(), 2500, "balance restored");

  await db.updateOrderStatus(id, "cancelled", { actor: "tester" });
  assert.equal(await db.currentCashboxBalance(), 0, "balance zero after cancel");

  await db.addCashboxTransaction({ type: "expense", amountCents: 1000, note: "كهرباء", actor: { id: 1, username: "tester" } });
  assert.equal(await db.currentCashboxBalance(), -1000, "expense reduces balance");

  const open = await db.openCashboxSession({ openingBalanceCents: 5000, actor: { id: 1, username: "tester" } });
  assert.equal(open.status, "open", "session open");
  await assert.rejects(
    () => db.openCashboxSession({ openingBalanceCents: 100, actor: { id: 1, username: "tester" } }),
    /مفتوح/,
    "cannot open while open",
  );

  assert.equal(await db.currentCashboxBalance(), 5000, "opening balance only before activity");

  const updAdmin = await db.updateCashboxOpening(open.id, 5000, { id: 2, username: "admin", role: "ADMIN" });
  assert.equal(updAdmin.openingBalanceCents, 5000, "admin can edit opening before activity");

  await db.addCashboxTransaction({ type: "income", amountCents: 3000, paymentMethod: "cash", actor: { id: 1, username: "tester" } });
  assert.equal(await db.currentCashboxBalance(), 8000, "session movement adds to balance");

  await assert.rejects(
    () => db.updateCashboxOpening(open.id, 9000, { id: 1, username: "admin", role: "ADMIN" }),
    /الرصيد/,
    "non-owner cannot edit opening after activity",
  );
  const upd = await db.updateCashboxOpening(open.id, 9000, { id: 1, username: "owner", role: "OWNER" });
  assert.equal(upd.openingBalanceCents, 9000, "owner can edit opening after activity");
  assert.equal(await db.currentCashboxBalance(), 12000, "balance uses updated opening");

  const closed = await db.closeCashboxSession(open.id, 12000, { id: 1, username: "tester" });
  assert.equal(closed.status, "closed", "session closed");
  assert.equal(closed.expectedCents, 12000, "expected = opening + movement");
  assert.equal(closed.diffCents, 0, "zero difference");
  await assert.rejects(() => db.closeCashboxSession(open.id, 0), /مغلق/, "cannot close twice");

  assert.equal(await db.currentCashboxBalance(), 12000, "balance carries closed actual");

  const exp = (await db.listCashboxTransactions({ type: "expense" })).rows[0];
  const corr = await db.correctCashboxTransaction(exp.id, "مبلغ خاطئ", { id: 1, username: "tester" });
  assert.equal(corr.type, "adjustment", "correction type");
  assert.equal(corr.direction, "in", "correction reverses direction");
  assert.equal(corr.correctsTxId, exp.id, "correction references original");
  assert.equal((await db.getCashboxTransaction(exp.id))!.status, "reversed", "original reversed");
  await assert.rejects(
    () => db.correctCashboxTransaction(exp.id, "مرة أخرى"),
    /مصححة/,
    "cannot correct twice",
  );
  assert.equal(await db.currentCashboxBalance(), 12000, "correction restores balance");

  const id2 = await db.createOrder(
    [{ productId: 0, name: "سلطة", qty: 1, unitCents: 1000, extras: [], removed: [] }],
    1000,
    { actor: "tester" },
  );
  await db.updateOrderStatus(id2, "completed", { actor: "tester" });
  assert.equal(await db.currentCashboxBalance(), 13000, "second order income adds");

  const now = Date.now();
  const sum = await db.cashboxSummary(now - 86400000, now + 1000);
  assert.equal(sum.period.incomeCents, 4000, "income total in period");
  assert.equal(sum.salesCents, 1000, "sales = order incomes in period");
  assert.equal(sum.paidOrders, 1, "paid orders in period");
  assert.equal(sum.txCount, 2, "active transactions in period");
  assert.ok(sum.byDay.length > 0, "daily chart available");
  assert.ok(sum.byType.some((b) => b.type === "income" && b.count === 2), "byType aggregates income");

  const id3 = await db.createOrder(
    [{ productId: 0, name: "قهوة", qty: 1, unitCents: 500, extras: [], removed: [] }],
    500,
    { actor: "tester" },
  );
  await db.updateOrderStatus(id3, "completed", { actor: "tester" });
  assert.equal(await db.currentCashboxBalance(), 13500, "balance before delete");
  await db.deleteOrder(id3);
  assert.equal(await db.currentCashboxBalance(), 13000, "deleteOrder reverts its income");

  await assert.rejects(() => db.addCashboxTransaction({ type: "expense", amountCents: 0 }), /المبلغ/, "zero amount rejected");
  await assert.rejects(() => db.addCashboxTransaction({ type: "expense", amountCents: -5 }), /المبلغ/, "negative amount rejected");
  await assert.rejects(() => db.addCashboxTransaction({ type: "nope" as never, amountCents: 100 }), /نوع/, "bad type rejected");

  const filtered = await db.listCashboxTransactions({ type: "income" });
  assert.equal(filtered.total, 5, "type filter works");
  const orderFiltered = await db.listCashboxTransactions({ orderId: id2 });
  assert.ok(orderFiltered.rows.every((r) => r.orderId === id2), "order filter works");

  console.log("test-cashbox: PASS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
