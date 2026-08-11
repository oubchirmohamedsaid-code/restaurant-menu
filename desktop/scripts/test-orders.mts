import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.OGT_DATA_DIR = join(tmpdir(), "ogt-tests", `orders-${Date.now()}`);

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const { createOrder, listOrders, getOrder, updateOrderStatus } = await import("../../lib/db");

  const before = await listOrders();
  const id = await createOrder(
    [
      {
        productId: 0,
        name: "بيتزا",
        qty: 2,
        unitCents: 4500,
        extras: [],
        removed: [],
      },
    ],
    9000,
    { customerName: "زبون اختبار", actor: "tester" },
  );

  const after = await listOrders();
  assert.equal(after.length, before.length + 1, "order appears in the shared list");
  assert.equal(after[0].id, id, "newest order first");
  assert.equal(after[0].status, "new", "new order status");

  const detail = await getOrder(id);
  assert.ok(detail, "order detail exists");
  assert.equal(detail!.lines.length, 1, "one line");
  assert.equal(detail!.lines[0].name, "بيتزا", "line name matches");
  assert.equal(detail!.lines[0].qty, 2, "line qty matches");
  assert.ok(detail!.activity.some((a) => a.action === "created"), "creation logged");

  await updateOrderStatus(id, "preparing", { actor: "tester" });
  assert.equal((await getOrder(id))!.order.status, "preparing", "status moved to preparing");

  await updateOrderStatus(id, "completed", { actor: "tester" });
  const done = (await getOrder(id))!.order;
  assert.equal(done.status, "completed", "status completed");
  assert.equal(done.paymentStatus, "paid", "auto-paid on completion");

  console.log("test-orders: PASS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
