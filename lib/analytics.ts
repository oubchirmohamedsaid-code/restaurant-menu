import { getDb, getStockSummary } from "./db";
import { CASHBOX_METHODS, CASHBOX_METHOD_LABELS } from "./cashbox";

export type AnalyticsPeriodKey = "today" | "7d" | "30d" | "month" | "year" | "custom";

export interface AnalyticsFilters {
  from: number;
  to: number;
}

export interface AnalyticsDay {
  key: string;
  ts: number;
  label: string;
  dateLabel: string;
  salesCents: number;
  orders: number;
  expensesCents: number;
}

export interface AnalyticsProduct {
  productId: number;
  name: string;
  imageUrl: string;
  categoryId: number | null;
  categoryName: string;
  categoryIcon: string;
  orders: number;
  qty: number;
  salesCents: number;
  share: number;
}

export interface AnalyticsCategoryStat {
  categoryId: number | null;
  name: string;
  icon: string;
  orders: number;
  qty: number;
  salesCents: number;
  share: number;
}

export interface AnalyticsMethodStat {
  method: string;
  label: string;
  count: number;
  salesCents: number;
  share: number;
}

export interface AnalyticsHour {
  hour: number;
  label: string;
  orders: number;
  salesCents: number;
}

export interface AnalyticsWeekdayStat {
  weekday: string;
  orders: number;
  salesCents: number;
}

export interface AnalyticsComparison {
  hasPrev: boolean;
  salesDelta: number | null;
  ordersDelta: number | null;
  expensesDelta: number | null;
  netDelta: number | null;
  avgOrderDelta: number | null;
  cancelRateDelta: number | null;
  avgTimeDelta: number | null;
  prev: {
    salesCents: number;
    orders: number;
    expensesCents: number;
    netCents: number;
    cancelRate: number | null;
    avgMinutes: number | null;
    avgOrderCents: number | null;
  };
}

export interface AnalyticsResult {
  period: { from: number; to: number; key: AnalyticsPeriodKey };
  ordersTotal: number;
  salesCents: number;
  expensesCents: number;
  netCents: number;
  avgOrderCents: number | null;
  completionRate: number | null;
  cancelRate: number | null;
  avgOrderMinutes: number | null;
  byStatus: Record<OrderStatusKey, number>;
  comparison: AnalyticsComparison;
  days: AnalyticsDay[];
  hours: AnalyticsHour[];
  weekdays: AnalyticsWeekdayStat[];
  topProducts: AnalyticsProduct[];
  bottomProducts: AnalyticsProduct[];
  byCategory: AnalyticsCategoryStat[];
  methods: AnalyticsMethodStat[];
  stageMinutes: { new: number | null; preparing: number | null; delivered: number | null };
  peak: { ordersHour: string | null; ordersCount: number; salesHour: string | null; salesCents: number };
  stock: {
    consumed: { itemId: number; name: string; unit: string; qty: number }[];
    lowCount: number;
    outCount: number;
    valueCents: number;
    totalItems: number;
  };
}

export type OrderStatusKey = "new" | "preparing" | "delivered" | "completed" | "cancelled";

const ORDER_STATUS_KEYS: OrderStatusKey[] = ["new", "preparing", "delivered", "completed", "cancelled"];

const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function dayKeyLocal(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayStartLocal(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function hourRangeLabel(h: number): string {
  return `${hourLabel(h)} - ${hourLabel((h + 1) % 24)}`;
}

function dateLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_AR[d.getMonth()]}`;
}

export function analyticsPeriodRange(
  key: AnalyticsPeriodKey,
  customFrom?: number,
  customTo?: number,
): AnalyticsFilters {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (key) {
    case "today":
      return { from: dayStart, to: dayStart + 86400000 - 1 };
    case "7d":
      return { from: dayStart - 6 * 86400000, to: dayStart + 86400000 - 1 };
    case "30d":
      return { from: dayStart - 29 * 86400000, to: dayStart + 86400000 - 1 };
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return { from: start, to: next - 1 };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1).getTime();
      const next = new Date(now.getFullYear() + 1, 0, 1).getTime();
      return { from: start, to: next - 1 };
    }
    case "custom": {
      const from = Number(customFrom);
      const to = Number(customTo);
      if (Number.isFinite(from) && Number.isFinite(to) && from <= to) {
        return { from: Math.floor(from), to: Math.ceil(to) };
      }
      return { from: dayStart, to: Date.now() };
    }
  }
}

function pct(cur: number, prev: number): number | null {
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

async function statusCounts(db: unknown, from: number, to: number): Promise<Record<OrderStatusKey, number>> {
  const d = db as { prepare(sql: string): { all(...a: unknown[]): Promise<Record<string, unknown>[]> } };
  const rows = await d.prepare("SELECT status, COUNT(*) AS n FROM orders WHERE createdAt >= ? AND createdAt <= ? GROUP BY status").all(from, to);
  const out: Record<OrderStatusKey, number> = { new: 0, preparing: 0, delivered: 0, completed: 0, cancelled: 0 };
  for (const r of rows) {
    const s = String(r.status) as OrderStatusKey;
    if (ORDER_STATUS_KEYS.includes(s)) out[s] = Number(r.n);
  }
  return out;
}

async function mapDays(db: unknown, from: number, to: number): Promise<Map<string, { salesCents: number; orders: number; expensesCents: number }>> {
  const d = db as { prepare(sql: string): { all(...a: unknown[]): Promise<Record<string, unknown>[]> } };
  const map = new Map<string, { salesCents: number; orders: number; expensesCents: number }>();
  const sales = await d
    .prepare(
      `SELECT strftime('%Y-%m-%d', completedAt/1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS n, SUM(totalCents) AS s
       FROM orders WHERE status = 'completed' AND completedAt IS NOT NULL AND completedAt >= ? AND completedAt <= ? GROUP BY day`,
    )
    .all(from, to);
  for (const r of sales) {
    const day = String(r.day);
    const cur = map.get(day) ?? { salesCents: 0, orders: 0, expensesCents: 0 };
    cur.salesCents += Number(r.s || 0);
    map.set(day, cur);
  }
  const created = await d
    .prepare(
      `SELECT strftime('%Y-%m-%d', createdAt/1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS n
       FROM orders WHERE createdAt >= ? AND createdAt <= ? GROUP BY day`,
    )
    .all(from, to);
  for (const r of created) {
    const day = String(r.day);
    const cur = map.get(day) ?? { salesCents: 0, orders: 0, expensesCents: 0 };
    cur.orders += Number(r.n);
    map.set(day, cur);
  }
  const expenses = await d
    .prepare(
      `SELECT strftime('%Y-%m-%d', createdAt/1000, 'unixepoch', 'localtime') AS day, SUM(amountCents) AS s
       FROM cashbox_transactions WHERE type = 'expense' AND status = 'active' AND correctsTxId IS NULL AND createdAt >= ? AND createdAt <= ? GROUP BY day`,
    )
    .all(from, to);
  for (const r of expenses) {
    const day = String(r.day);
    const cur = map.get(day) ?? { salesCents: 0, orders: 0, expensesCents: 0 };
    cur.expensesCents += Number(r.s || 0);
    map.set(day, cur);
  }
  return map;
}

async function completedTotals(db: unknown, from: number, to: number): Promise<{ count: number; salesCents: number }> {
  const d = db as { prepare(sql: string): { get(...a: unknown[]): Promise<Record<string, unknown> | undefined> } };
  const row = await d
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(totalCents), 0) AS s FROM orders WHERE status = 'completed' AND completedAt IS NOT NULL AND completedAt >= ? AND completedAt <= ?`,
    )
    .get(from, to);
  return { count: Number(row?.n ?? 0), salesCents: Number(row?.s ?? 0) };
}

export async function getAnalytics(filters: AnalyticsFilters, periodKey: AnalyticsPeriodKey): Promise<AnalyticsResult> {
  const db = await getDb();
  const d = db as unknown as {
    prepare(sql: string): {
      all(...a: unknown[]): Promise<Record<string, unknown>[]>;
      get(...a: unknown[]): Promise<Record<string, unknown> | undefined>;
    };
  };
  const { from, to } = filters;

  const status = await statusCounts(d, from, to);
  const ordersTotal = ORDER_STATUS_KEYS.reduce((s, k) => s + status[k], 0);
  const completed = await completedTotals(d, from, to);
  const salesCents = completed.salesCents;
  const completedCount = completed.count;

  const expensesRow = await d
    .prepare(
      `SELECT COALESCE(SUM(amountCents), 0) AS s FROM cashbox_transactions WHERE type = 'expense' AND status = 'active' AND correctsTxId IS NULL AND createdAt >= ? AND createdAt <= ?`,
    )
    .get(from, to);
  const expensesCents = Number(expensesRow?.s ?? 0);
  const netCents = salesCents - expensesCents;
  const avgOrderCents = completedCount > 0 ? Math.round(salesCents / completedCount) : null;
  const completionRate = ordersTotal > 0 ? (status.completed / ordersTotal) * 100 : null;
  const cancelRate = ordersTotal > 0 ? (status.cancelled / ordersTotal) * 100 : null;

  // Average + stage times from orders created in period.
  const timeRows = await d
    .prepare(
      "SELECT createdAt, preparingAt, deliveredAt, completedAt FROM orders WHERE status = 'completed' AND createdAt >= ? AND createdAt <= ?",
    )
    .all(from, to);
  let avgOrderMs = 0;
  let newMs = 0;
  let preparingMs = 0;
  let deliveredMs = 0;
  let newN = 0;
  let preparingN = 0;
  let deliveredN = 0;
  for (const r of timeRows) {
    const created = Number(r.createdAt);
    const completedAt = Number(r.completedAt);
    if (completedAt > 0) avgOrderMs += completedAt - created;
    const preparingAt = Number(r.preparingAt);
    const deliveredAt = Number(r.deliveredAt);
    if (preparingAt > 0) {
      newMs += preparingAt - created;
      newN += 1;
    }
    if (deliveredAt > 0 && preparingAt > 0) {
      preparingMs += deliveredAt - preparingAt;
      preparingN += 1;
    }
    if (completedAt > 0 && deliveredAt > 0) {
      deliveredMs += completedAt - deliveredAt;
      deliveredN += 1;
    }
  }
  const avgOrderMinutes = timeRows.length > 0 ? Math.round(avgOrderMs / timeRows.length / 60000) : null;
  const stageMinutes = {
    new: newN > 0 ? Math.round(newMs / newN / 60000) : null,
    preparing: preparingN > 0 ? Math.round(preparingMs / preparingN / 60000) : null,
    delivered: deliveredN > 0 ? Math.round(deliveredMs / deliveredN / 60000) : null,
  };

  // Daily buckets.
  const dayMap = await mapDays(d, from, to);
  const days: AnalyticsDay[] = [];
  for (let start = dayStartLocal(from); start <= to; start += 86400000) {
    const key = dayKeyLocal(start);
    const v = dayMap.get(key) ?? { salesCents: 0, orders: 0, expensesCents: 0 };
    days.push({
      key,
      ts: start,
      label: WEEKDAYS_AR[new Date(start).getDay()],
      dateLabel: dateLabel(start),
      salesCents: v.salesCents,
      orders: v.orders,
      expensesCents: v.expensesCents,
    });
  }

  // Hours.
  const hourRows = await d
    .prepare(
      `SELECT CAST(strftime('%H', completedAt/1000, 'unixepoch', 'localtime') AS INTEGER) AS hour, COUNT(*) AS n, COALESCE(SUM(totalCents), 0) AS s
       FROM orders WHERE status = 'completed' AND completedAt IS NOT NULL AND completedAt >= ? AND completedAt <= ? GROUP BY hour`,
    )
    .all(from, to);
  const hourMap = new Map<number, { orders: number; salesCents: number }>();
  for (const r of hourRows) hourMap.set(Number(r.hour), { orders: Number(r.n), salesCents: Number(r.s) });
  const hours: AnalyticsHour[] = [];
  for (let h = 0; h < 24; h += 1) {
    const v = hourMap.get(h) ?? { orders: 0, salesCents: 0 };
    hours.push({ hour: h, label: hourLabel(h), orders: v.orders, salesCents: v.salesCents });
  }

  // Weekdays (from completed orders).
  const dowRows = await d
    .prepare(
      `SELECT CAST(strftime('%w', completedAt/1000, 'unixepoch', 'localtime') AS INTEGER) AS dow, COUNT(*) AS n, COALESCE(SUM(totalCents), 0) AS s
       FROM orders WHERE status = 'completed' AND completedAt IS NOT NULL AND completedAt >= ? AND completedAt <= ? GROUP BY dow`,
    )
    .all(from, to);
  const dowMap = new Map<number, { orders: number; salesCents: number }>();
  for (const r of dowRows) dowMap.set(Number(r.dow), { orders: Number(r.n), salesCents: Number(r.s) });
  const weekdays = WEEKDAYS_AR.map((weekday, i) => {
    const v = dowMap.get(i) ?? { orders: 0, salesCents: 0 };
    return { weekday, orders: v.orders, salesCents: v.salesCents };
  }).sort((a, b) => b.orders - a.orders);

  // Products + categories.
  const productRows = await d
    .prepare(
      `SELECT ol.productId AS productId, COALESCE(p.name, ol.name) AS name, COALESCE(p.imageUrl, '') AS imageUrl, p.categoryId AS categoryId, COALESCE(c.nameAr, '') AS categoryName, COALESCE(c.icon, '') AS categoryIcon,
              COUNT(DISTINCT ol.orderId) AS orders, SUM(ol.qty) AS qty, SUM(ol.lineCents) AS salesCents
       FROM order_line ol
       JOIN orders o ON o.id = ol.orderId
       LEFT JOIN Product p ON p.id = ol.productId
       LEFT JOIN Category c ON c.id = p.categoryId
       WHERE o.status = 'completed' AND o.completedAt IS NOT NULL AND o.completedAt >= ? AND o.completedAt <= ? AND ol.productId != 0
       GROUP BY ol.productId`,
    )
    .all(from, to);
  const products: AnalyticsProduct[] = productRows.map((r) => ({
    productId: Number(r.productId),
    name: String(r.name),
    imageUrl: String(r.imageUrl ?? ""),
    categoryId: r.categoryId != null ? Number(r.categoryId) : null,
    categoryName: String(r.categoryName ?? ""),
    categoryIcon: String(r.categoryIcon ?? ""),
    orders: Number(r.orders),
    qty: Number(r.qty),
    salesCents: Number(r.salesCents),
    share: 0,
  }));
  for (const p of products) {
    p.share = salesCents > 0 ? (p.salesCents / salesCents) * 100 : 0;
  }
  const sortedBySales = [...products].sort((a, b) => b.salesCents - a.salesCents);
  const topProducts = sortedBySales.slice(0, 8);
  const topIds = new Set(topProducts.map((p) => p.productId));
  const bottomProducts = sortedBySales
    .filter((p) => p.qty > 0 && !topIds.has(p.productId))
    .slice(-5)
    .reverse();

  const catMap = new Map<number | null, AnalyticsCategoryStat>();
  for (const p of products) {
    const id = p.categoryId;
    const cur = catMap.get(id) ?? {
      categoryId: id,
      name: id != null && p.categoryName ? p.categoryName : "أخرى",
      icon: id != null && p.categoryIcon ? p.categoryIcon : "🍽️",
      orders: 0,
      qty: 0,
      salesCents: 0,
      share: 0,
    };
    cur.orders += p.orders;
    cur.qty += p.qty;
    cur.salesCents += p.salesCents;
    catMap.set(id, cur);
  }
  const byCategory = [...catMap.values()].sort((a, b) => b.salesCents - a.salesCents);
  for (const c of byCategory) c.share = salesCents > 0 ? (c.salesCents / salesCents) * 100 : 0;

  // Payment methods.
  const methodRows = await d
    .prepare(
      `SELECT paymentMethod, COUNT(*) AS n, SUM(totalCents) AS s FROM orders WHERE status = 'completed' AND completedAt IS NOT NULL AND completedAt >= ? AND completedAt <= ? GROUP BY paymentMethod`,
    )
    .all(from, to);
  const methodMap = new Map<string, { count: number; salesCents: number }>();
  for (const r of methodRows) {
    const m = String(r.paymentMethod || "other");
    methodMap.set(m, { count: Number(r.n), salesCents: Number(r.s) });
  }
  const methods: AnalyticsMethodStat[] = [];
  for (const m of CASHBOX_METHODS) {
    const v = methodMap.get(m) ?? { count: 0, salesCents: 0 };
    methods.push({ method: m, label: CASHBOX_METHOD_LABELS[m] ?? m, count: v.count, salesCents: v.salesCents, share: salesCents > 0 ? (v.salesCents / salesCents) * 100 : 0 });
  }
  methods.sort((a, b) => b.salesCents - a.salesCents);

  // Peak hours.
  const ordersPeak = hours.reduce((best, h) => (h.orders > best.orders ? h : best), hours[0]);
  const salesPeak = hours.reduce((best, h) => (h.salesCents > best.salesCents ? h : best), hours[0]);
  const peak = {
    ordersHour: ordersPeak.orders > 0 ? hourRangeLabel(ordersPeak.hour) : null,
    ordersCount: ordersPeak.orders,
    salesHour: salesPeak.salesCents > 0 ? hourRangeLabel(salesPeak.hour) : null,
    salesCents: salesPeak.salesCents,
  };

  // Stock summary.
  const stockSummary = await getStockSummary();
  const consumedRows = await d
    .prepare(
      `SELECT m.itemId AS itemId, i.name AS name, i.unit AS unit, -SUM(m.quantity) AS qty
       FROM stock_movements m JOIN stock_items i ON i.id = m.itemId
       WHERE m.kind = 'sale' AND m.createdAt >= ? AND m.createdAt <= ?
       GROUP BY m.itemId ORDER BY qty DESC LIMIT 5`,
    )
    .all(from, to);
  const stock = {
    consumed: consumedRows.map((r) => ({ itemId: Number(r.itemId), name: String(r.name), unit: String(r.unit), qty: Math.round(Number(r.qty) * 1000) / 1000 })),
    lowCount: stockSummary.lowItems,
    outCount: stockSummary.outItems,
    valueCents: stockSummary.stockValueCents,
    totalItems: stockSummary.totalItems,
  };

  // Comparison with previous period.
  const span = to - from + 1;
  const prevFrom = from - span;
  const prevTo = from - 1;
  let comparison: AnalyticsComparison = {
    hasPrev: false,
    salesDelta: null,
    ordersDelta: null,
    expensesDelta: null,
    netDelta: null,
    avgOrderDelta: null,
    cancelRateDelta: null,
    avgTimeDelta: null,
    prev: { salesCents: 0, orders: 0, expensesCents: 0, netCents: 0, cancelRate: null, avgMinutes: null, avgOrderCents: null },
  };
  if (prevFrom >= 0 && prevTo >= prevFrom) {
    const prevStatus = await statusCounts(d, prevFrom, prevTo);
    const prevOrders = ORDER_STATUS_KEYS.reduce((s, k) => s + prevStatus[k], 0);
    const prevCompleted = await completedTotals(d, prevFrom, prevTo);
    const prevExpRow = await d
      .prepare(
        `SELECT COALESCE(SUM(amountCents), 0) AS s FROM cashbox_transactions WHERE type = 'expense' AND status = 'active' AND correctsTxId IS NULL AND createdAt >= ? AND createdAt <= ?`,
      )
      .get(prevFrom, prevTo);
    const prevExpenses = Number(prevExpRow?.s ?? 0);
    const prevNet = prevCompleted.salesCents - prevExpenses;
    const prevAvgOrder = prevCompleted.count > 0 ? Math.round(prevCompleted.salesCents / prevCompleted.count) : null;
    const prevCancel = prevOrders > 0 ? (prevStatus.cancelled / prevOrders) * 100 : null;
    const prevTimeRows = await d
      .prepare("SELECT createdAt, completedAt FROM orders WHERE status = 'completed' AND createdAt >= ? AND createdAt <= ?")
      .all(prevFrom, prevTo);
    let prevAvgMs = 0;
    for (const r of prevTimeRows) prevAvgMs += Number(r.completedAt) - Number(r.createdAt);
    const prevAvgMinutes = prevTimeRows.length > 0 ? Math.round(prevAvgMs / prevTimeRows.length / 60000) : null;

    const hasPrev = prevOrders > 0 || prevCompleted.count > 0 || prevExpenses > 0;
    comparison = {
      hasPrev,
      salesDelta: pct(salesCents, prevCompleted.salesCents),
      ordersDelta: pct(ordersTotal, prevOrders),
      expensesDelta: pct(expensesCents, prevExpenses),
      netDelta: pct(netCents, prevNet),
      avgOrderDelta: prevAvgOrder != null && avgOrderCents != null ? pct(avgOrderCents, prevAvgOrder) : null,
      cancelRateDelta: prevCancel != null && cancelRate != null ? pct(cancelRate, prevCancel) : null,
      avgTimeDelta: prevAvgMinutes != null && avgOrderMinutes != null ? pct(avgOrderMinutes, prevAvgMinutes) : null,
      prev: {
        salesCents: prevCompleted.salesCents,
        orders: prevOrders,
        expensesCents: prevExpenses,
        netCents: prevNet,
        cancelRate: prevCancel,
        avgMinutes: prevAvgMinutes,
        avgOrderCents: prevAvgOrder,
      },
    };
  }

  return {
    period: { from, to, key: periodKey },
    ordersTotal,
    salesCents,
    expensesCents,
    netCents,
    avgOrderCents,
    completionRate,
    cancelRate,
    avgOrderMinutes,
    byStatus: status,
    comparison,
    days,
    hours,
    weekdays,
    topProducts,
    bottomProducts,
    byCategory,
    methods,
    stageMinutes,
    peak,
    stock,
  };
}
