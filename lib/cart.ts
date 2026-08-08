import { formatPrice } from "./utils";

export interface IngredientPick {
  id: number;
  name: string;
  priceCents: number;
}

export interface RemovedIngredient {
  id: number;
  name: string;
}

export interface CartLine {
  productId: number;
  key: string;
  name: string;
  priceCents: number;
  imageUrl: string;
  qty: number;
  extras: IngredientPick[];
  removed: RemovedIngredient[];
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

export function cartTotalCents(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.priceCents * l.qty, 0);
}

export function formatOrderLine(l: {
  name: string;
  qty: number;
  priceCents: number;
  extras: string[];
  removed: string[];
}): string {
  const parts = [`${l.name} × ${l.qty}`];
  if (l.removed.length > 0) parts.push(`بدون: ${l.removed.join("، ")}`);
  if (l.extras.length > 0) parts.push(`+ ${l.extras.join("، ")}`);
  parts.push(formatPrice(l.priceCents * l.qty));
  return parts.join(" — ");
}
