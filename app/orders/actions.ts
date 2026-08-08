"use server";

import {
  createOrder,
  getProductById,
  listIngredientsByProduct,
} from "@/lib/db";
import { formatOrderLine } from "@/lib/cart";
import type { CartLine } from "@/lib/cart";
import { logger } from "@/lib/logger";

export interface OrderActionResult {
  ok?: boolean;
  orderId?: number;
  error?: string;
}

const MAX_QTY = 99;
const MAX_PICKS = 50;

export async function placeOrderAction(lines: CartLine[]): Promise<OrderActionResult> {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { error: "السلة فارغة" };
  }

  const items: string[] = [];
  let totalCents = 0;

  for (const l of lines.slice(0, MAX_PICKS)) {
    if (!l || typeof l.productId !== "number" || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY) {
      return { error: "بنود غير صالحة" };
    }
    const product = getProductById(l.productId);
    if (!product || product.isAvailable !== 1) {
      return { error: `طبق غير متوفر: ${l.name}` };
    }
    const ingredients = listIngredientsByProduct(product.id);
    const byId = new Map(ingredients.map((i) => [i.id, i]));
    const extras = (l.extras ?? [])
      .filter((e) => e && byId.has(e.id))
      .slice(0, MAX_PICKS);
    const removed = (l.removed ?? [])
      .filter((r) => r && byId.has(r.id))
      .slice(0, MAX_PICKS);

    const unitCents =
      product.priceCents + extras.reduce((s, e) => s + byId.get(e.id)!.priceCents, 0);
    totalCents += unitCents * l.qty;
    items.push(
      formatOrderLine({
        name: product.name,
        qty: l.qty,
        priceCents: unitCents,
        extras: extras.map((e) => e.name),
        removed: removed.map((r) => byId.get(r.id)!.name),
      }),
    );
  }

  const orderId = createOrder(JSON.stringify(items), totalCents);
  logger.info("order placed", { orderId, totalCents, items: items.length });
  return { ok: true, orderId };
}
