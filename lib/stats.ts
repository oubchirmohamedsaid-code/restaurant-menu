import type { OrderRow, OrderLineRow } from "./db";
import { ORDER_STATUSES, PRIORITIES } from "./orders";
import type { OrderStatus, OrderPriority } from "./orders";

export interface DayStat {
  key: string;
  label: string;
  orders: number;
  revenueCents: number;
}

export interface StatusStat {
  status: OrderStatus;
  count: number;
}

export interface PriorityStat {
  priority: OrderPriority;
  count: number;
}

export interface TopProduct {
  name: string;
  qty: number;
  revenueCents: number;
  productId: number;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenueCents: number;
  activeOrders: number;
  unpaidOrders: number;
  cancelledOrders: number;
  avgOrderCents: number;
  last7Days: DayStat[];
  byStatus: StatusStat[];
  byPriority: PriorityStat[];
  topProducts: TopProduct[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function computeStats(orders: OrderRow[], lines: OrderLineRow[], now = Date.now()): OrderStats {
  const nonCancelled = orders.filter((o) => o.status !== "cancelled");
  const revenueCents = (o: OrderRow) => (o.status === "cancelled" ? 0 : o.totalCents);

  const totalOrders = orders.length;
  const totalRevenueCents = nonCancelled.reduce((sum, o) => sum + o.totalCents, 0);
  const activeOrders = orders.filter((o) => o.status === "new" || o.status === "preparing" || o.status === "delivered").length;
  const unpaidOrders = orders.filter((o) => o.paymentStatus === "unpaid" && o.status !== "cancelled").length;
  const cancelledOrders = orders.length - nonCancelled.length;
  const avgOrderCents =
    nonCancelled.length > 0 ? Math.round(totalRevenueCents / nonCancelled.length) : 0;

  const today = startOfDay(now);

  const buckets = new Map<string, DayStat>();
  for (let i = 6; i >= 0; i--) {
    const key = dayKey(today - i * DAY_MS);
    buckets.set(key, { key, label: dayLabel(key), orders: 0, revenueCents: 0 });
  }
  for (const o of orders) {
    const bucket = buckets.get(dayKey(o.createdAt));
    if (bucket) {
      bucket.orders += 1;
      bucket.revenueCents += revenueCents(o);
    }
  }

  const byStatus: StatusStat[] = ORDER_STATUSES.map((status) => ({
    status,
    count: orders.filter((o) => o.status === status).length,
  }));

  const byPriority: PriorityStat[] = PRIORITIES.map((priority) => ({
    priority,
    count: orders.filter((o) => o.priority === priority).length,
  }));

  const productMap = new Map<string, TopProduct>();
  for (const l of lines) {
    const p = productMap.get(l.name);
    if (p) {
      p.qty += l.qty;
      p.revenueCents += l.lineCents;
    } else {
      productMap.set(l.name, { name: l.name, qty: l.qty, revenueCents: l.lineCents, productId: l.productId });
    }
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  return {
    totalOrders,
    totalRevenueCents,
    activeOrders,
    unpaidOrders,
    cancelledOrders,
    avgOrderCents,
    last7Days: [...buckets.values()],
    byStatus,
    byPriority,
    topProducts,
  };
}
