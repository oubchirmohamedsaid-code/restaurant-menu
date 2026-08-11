export type StockItemType = "raw" | "component" | "finished" | "packaging" | "other";

export type StockItemStatus = "available" | "low" | "out";

export type StockMovementKind = "in" | "out" | "adjust" | "count" | "sale" | "restore";

export const STOCK_ITEM_TYPES: StockItemType[] = [
  "raw",
  "component",
  "finished",
  "packaging",
  "other",
];

export const STOCK_TYPE_LABELS: Record<StockItemType, string> = {
  raw: "مادة خام",
  component: "مكوّن",
  finished: "منتج نهائي",
  packaging: "تغليف",
  other: "أخرى",
};

export const STOCK_UNITS = ["kg", "g", "L", "ml", "piece", "box", "pack"];

export const STOCK_MOVEMENT_KINDS: StockMovementKind[] = [
  "in",
  "out",
  "adjust",
  "count",
  "sale",
  "restore",
];

export const STOCK_KIND_LABELS: Record<StockMovementKind, string> = {
  in: "إدخال",
  out: "إخراج",
  adjust: "تسوية",
  count: "جرد/عد",
  sale: "استهلاك طلب",
  restore: "استرجاع",
};

export interface StockItemRow {
  id: number;
  name: string;
  imageUrl: string;
  type: StockItemType;
  quantity: number;
  unit: string;
  minQuantity: number;
  unitCostCents: number;
  supplier: string;
  note: string;
  archived: number;
  createdAt: number;
  updatedAt: number;
}

export interface StockMovementRow {
  id: number;
  itemId: number;
  itemName: string;
  kind: StockMovementKind;
  quantity: number;
  prevQuantity: number;
  newQuantity: number;
  refType: string;
  refId: number | null;
  supplier: string;
  invoice: string;
  reason: string;
  note: string;
  userId: number;
  userName: string;
  createdAt: number;
}

export interface StockListFilters {
  type?: StockItemType | "";
  search?: string;
  archived?: 0 | 1;
}

export interface StockMovementFilters {
  from?: number;
  to?: number;
  itemId?: number;
  kind?: StockMovementKind | "";
  user?: string;
  search?: string;
  limit?: number;
}

export interface StockSummary {
  totalItems: number;
  lowItems: number;
  outItems: number;
  stockValueCents: number;
  reorderItems: StockItemRow[];
}

export interface ProductIngredientRow {
  productId: number;
  itemId: number;
  qty: number;
}

export interface ProductIngredientsView {
  productId: number;
  name: string;
  priceCents: number;
  isAvailable: number;
  isHidden: number;
  hasRecipes: boolean;
  unavailable: boolean;
  items: {
    itemId: number;
    name: string;
    unit: string;
    qty: number;
    quantity: number;
    minQuantity: number;
    status: StockItemStatus;
  }[];
}

export interface StockConsumptionRow {
  id: number;
  orderId: number;
  orderLineId: number;
  itemId: number;
  qty: number;
  restored: number;
  createdAt: number;
}

export function stockItemStatus(item: Pick<StockItemRow, "quantity" | "minQuantity">): StockItemStatus {
  if (item.quantity <= 0) return "out";
  if (item.minQuantity > 0 && item.quantity < item.minQuantity) return "low";
  return "available";
}

export function stockValueCents(item: Pick<StockItemRow, "quantity" | "unitCostCents">): number {
  return Math.round(item.quantity * item.unitCostCents);
}

export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}
