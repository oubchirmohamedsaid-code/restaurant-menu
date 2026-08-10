import assert from "node:assert";
import "dotenv/config";
import { createOrder, deleteOrder } from "../lib/db";
import { createSessionToken } from "../lib/session";

const BASE = "http://localhost:3799";

async function readLine(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value } = await reader.read();
  if (!value) throw new Error("stream closed early");
  return new TextDecoder().decode(value);
}

async function main() {
  const token = createSessionToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const res = await fetch(`${BASE}/admin/orders/events`, {
    headers: { Cookie: `admin_session=${token}` },
    signal: controller.signal,
  });
  assert.strictEqual(res.status, 200, "SSE should open");
  const reader = res.body!.getReader();

  let data = "";
  for (let i = 0; i < 10 && !data.includes("init"); i++) {
    data += await readLine(reader);
  }
  assert.ok(data.includes("init"), "expected init event before any new orders");

  const orderId = await createOrder(
    [{ productId: 1, name: "سندويتش اختبار", qty: 1, unitCents: 500, extras: [], removed: [] }],
    500,
    { actor: "sse-test" },
  );

  let sawEvent = false;
  for (let i = 0; i < 10; i++) {
    data += await readLine(reader);
    if (data.includes(`"id":${orderId}`) && data.includes("new_order")) {
      sawEvent = true;
      break;
    }
  }

  await deleteOrder(orderId);
  clearTimeout(timeout);
  reader.cancel().catch(() => {});
  controller.abort();

  assert.ok(sawEvent, `expected new_order event for order ${orderId}`);
  console.log(`✓ SSE delivered new_order for order #${orderId}`);
}

main().catch((err) => {
  console.error("SSE TEST FAILED:", err);
  process.exit(1);
});
