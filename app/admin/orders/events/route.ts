import { cookies } from "next/headers";
import { listOrders } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_COOKIE = "admin_session";
const POLL_MS = 4000;
const HEARTBEAT_MS = 20000;

export async function GET(request: Request) {
  const store = await cookies();
  const authed = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!authed) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {},
  });

  const send = (event: string, data: unknown) => {
    try {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    } catch {
      // client gone
    }
  };

  const heartbeat = () => {
    try {
      controller.enqueue(encoder.encode(": ping\n\n"));
    } catch {
      // client gone
    }
  };

  request.signal.addEventListener("abort", () => {
    try {
      controller.close();
    } catch {
      // already closed
    }
  });

  let lastId = -1;
  let first = true;
  let lastHeartbeat = Date.now();

  const poll = async () => {
    try {
      const orders = await listOrders();
      const maxId = orders.length > 0 ? Math.max(...orders.map((o) => o.id)) : lastId;
      if (first) {
        send("init", { lastId: maxId });
        first = false;
      } else {
        for (const order of orders) {
          if (order.id > lastId) {
            send("new_order", {
              id: order.id,
              totalCents: order.totalCents,
              createdAt: order.createdAt,
            });
          }
        }
      }
      if (maxId > lastId) lastId = maxId;
    } catch {
      // db hiccup: keep the connection alive, retry next tick
    }
    const now = Date.now();
    if (now - lastHeartbeat >= HEARTBEAT_MS) {
      heartbeat();
      lastHeartbeat = now;
    }
  };

  const loop = async () => {
    await poll();
    while (!request.signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      if (request.signal.aborted) break;
      await poll();
    }
  };

  void loop();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
