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

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function flyVector(from: Rect, to: Rect): { dx: number; dy: number } {
  return {
    dx: to.x + to.width / 2 - (from.x + from.width / 2),
    dy: to.y + to.height / 2 - (from.y + from.height / 2),
  };
}

export const FLY_TARGET_OPACITY = 1;
export const FLY_TARGET_SCALE = 0.08;

export const FLY_PREP_SCALE = 0.5;

export const FLY_PREP_TRANSITION: {
  duration: number;
  ease: [number, number, number, number];
} = { duration: 0.85, ease: [0.65, 0.05, 0.36, 1] };

export const FLY_LAUNCH_TRANSITION: {
  x: { duration: number; ease: [number, number, number, number] };
  y: { duration: number; ease: [number, number, number, number] };
  scale: { duration: number; ease: [number, number, number, number] };
  opacity: { duration: number };
} = {
  x: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  y: { duration: 0.5, ease: [0.5, 0, 1, 0.5] },
  scale: { duration: 0.5, ease: [0.5, 0, 1, 0.5] },
  opacity: { duration: 0.5 },
};

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
