"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelOrderAction,
  completeOrderAction,
  confirmOrderAction,
  markDeliveredAction,
} from "@/app/admin/actions";
import type { ActionResult } from "@/app/admin/actions";
import type { OrderRow } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import {
  CANCEL_REASONS,
  isLate,
  minutesInStage,
  PRIORITIES,
  PRIORITY_LABELS,
  stageStartTs,
  STATUS_LABELS,
} from "@/lib/orders";
import type { OrderPriority, OrderStatus } from "@/lib/orders";

export interface LateThresholds {
  new: number;
  preparing: number;
  delivered: number;
}

const ACTIVE_STATUSES: OrderStatus[] = ["new", "preparing", "delivered", "completed"];

const PRIORITY_CHIP: Record<OrderPriority, string> = {
  normal: "bg-surface text-muted",
  important: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-600",
};

function CardButton({
  children,
  onClick,
  disabled,
  kind,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  kind?: "primary" | "danger";
}) {
  const base =
    "rounded-full px-4 py-1.5 text-xs font-extrabold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
  const kindCls =
    kind === "primary"
      ? "bg-accent text-black hover:brightness-110"
      : kind === "danger"
        ? "border border-red-300 text-red-500 hover:bg-red-50"
        : "border border-line text-muted hover:text-foreground";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${kindCls}`}>
      {children}
    </button>
  );
}

function OrderCard({
  order,
  thresholds,
  busy,
  onAdvance,
  onCancelClick,
}: {
  order: OrderRow;
  thresholds: LateThresholds;
  busy: boolean;
  onAdvance: (orderId: number, action: "confirm" | "deliver" | "complete") => void;
  onCancelClick: (order: OrderRow) => void;
}) {
  const late = isLate(order, thresholds);
  const minutes = minutesInStage(order);
  const cancelled = order.status === "cancelled";

  return (
    <div
      className={`rounded-2xl border bg-background p-3.5 shadow-sm transition-colors ${
        late ? "border-red-300" : "border-line"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-black text-accent-strong">
          #{order.id}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
            PRIORITY_CHIP[order.priority]
          }`}
        >
          {PRIORITY_LABELS[order.priority]}
        </span>
      </div>

      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-muted">
          {new Date(order.createdAt).toLocaleTimeString("ar", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="text-base font-black text-accent">{formatPrice(order.totalCents)}</p>
      </div>

      {cancelled ? (
        <p className="text-xs text-muted">{order.cancelReason || "تم الإلغاء"}</p>
      ) : (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted">{order.items ? itemCount(order.items) : 0} صنف</p>
          {minutes !== null && (
            <p className={`text-[11px] font-extrabold ${late ? "text-red-500" : "text-muted"}`}>
              {late ? `⚠️ متأخر · ${minutes} د` : `${minutes} د`}
            </p>
          )}
        </div>
      )}

      {!cancelled && order.status !== "completed" && (
        <div className="flex flex-wrap gap-1.5">
          {order.status === "new" && (
            <>
              <CardButton kind="primary" onClick={() => onAdvance(order.id, "confirm")} disabled={busy}>
                تأكيد الطلب
              </CardButton>
              <CardButton kind="danger" onClick={() => onCancelClick(order)} disabled={busy}>
                إلغاء
              </CardButton>
            </>
          )}
          {order.status === "preparing" && (
            <>
              <CardButton kind="primary" onClick={() => onAdvance(order.id, "deliver")} disabled={busy}>
                تم التوصيل
              </CardButton>
              <CardButton kind="danger" onClick={() => onCancelClick(order)} disabled={busy}>
                إلغاء
              </CardButton>
            </>
          )}
          {order.status === "delivered" && (
            <>
              <CardButton kind="primary" onClick={() => onAdvance(order.id, "complete")} disabled={busy}>
                إكمال الطلب
              </CardButton>
              <CardButton kind="danger" onClick={() => onCancelClick(order)} disabled={busy}>
                إلغاء
              </CardButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function itemCount(itemsJson: string): number {
  try {
    const parsed = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function sortColumn(orders: OrderRow[]): OrderRow[] {
  return [...orders].sort((a, b) => {
    const aStart = stageStartTs(a);
    const bStart = stageStartTs(b);
    if (aStart !== null && bStart !== null) return aStart - bStart;
    if (aStart !== null) return -1;
    if (bStart !== null) return 1;
    return b.id - a.id;
  });
}

export function OrdersPipelineView({
  orders,
  thresholds,
}: {
  orders: OrderRow[];
  thresholds: LateThresholds;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [lateOnly, setLateOnly] = useState(false);
  const [priority, setPriority] = useState<"all" | OrderPriority>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [cancelling, setCancelling] = useState<OrderRow | null>(null);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(t);
  }, [router]);

  async function run<T>(action: () => Promise<T>): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      const res = (await action()) as ActionResult;
      if (res.error) setError(res.error);
      else router.refresh();
    } catch (e) {
      const digest = (e as { digest?: string })?.digest;
      if (digest?.startsWith("NEXT_REDIRECT")) return;
      setError("حدث خطأ أثناء تنفيذ العملية");
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim();
    return orders.filter((o) => {
      if (lateOnly && !isLate(o, thresholds)) return false;
      if (priority !== "all" && o.priority !== priority) return false;
      if (q) {
        const idMatch = String(o.id).includes(q);
        let itemMatch = false;
        try {
          const parsed = JSON.parse(o.items);
          if (Array.isArray(parsed)) itemMatch = parsed.some((s) => typeof s === "string" && s.includes(q));
        } catch {
          itemMatch = false;
        }
        if (!idMatch && !itemMatch) return false;
      }
      return true;
    });
  }, [orders, query, lateOnly, priority, thresholds]);

  const grouped = useMemo(() => {
    const map: Record<OrderStatus, OrderRow[]> = {
      new: [],
      preparing: [],
      delivered: [],
      completed: [],
      cancelled: [],
    };
    for (const o of filtered) map[o.status].push(o);
    for (const s of ACTIVE_STATUSES) map[s] = sortColumn(map[s]);
    map.cancelled.sort((a, b) => b.id - a.id);
    return map;
  }, [filtered]);

  const lateCount = orders.filter((o) => isLate(o, thresholds)).length;

  function advance(orderId: number, action: "confirm" | "deliver" | "complete") {
    void run(() =>
      action === "confirm"
        ? confirmOrderAction(orderId)
        : action === "deliver"
          ? markDeliveredAction(orderId)
          : completeOrderAction(orderId),
    );
  }

  function doCancel(reason: string) {
    if (!cancelling) return;
    const id = cancelling.id;
    setCancelling(null);
    void run(() => cancelOrderAction(id, reason));
  }

  return (
    <div className="p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black md:text-3xl">لوحة الطلبات</h1>
          <p className="mt-1 text-sm text-muted">
            {orders.length} طلب · {lateCount} متأخر
            {lateCount > 0 && <span aria-hidden> ⚠️</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث برقم الطلب أو الطبق…"
            className="w-52 rounded-xl border border-line bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent md:w-64"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as "all" | OrderPriority)}
            className="rounded-xl border border-line bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
          >
            <option value="all">كل الأولويات</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setLateOnly((v) => !v)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              lateOnly
                ? "bg-red-100 text-red-600"
                : "border border-line text-muted hover:text-foreground"
            }`}
          >
            متأخرة فقط
          </button>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-full border border-line px-4 py-2 text-sm font-bold text-muted transition-colors hover:text-foreground"
          >
            تحديث
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:items-start">
        {ACTIVE_STATUSES.map((s) => (
          <div
            key={s}
            className="w-72 shrink-0 rounded-3xl border border-line bg-card/60 p-3 lg:w-auto"
          >
            <header className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-black">{STATUS_LABELS[s]}</span>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-black text-accent-strong">
                {grouped[s].length}
              </span>
            </header>
            <div className="flex flex-col gap-3">
              {grouped[s].length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-muted">لا طلبات</p>
              ) : (
                grouped[s].map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    thresholds={thresholds}
                    busy={busy}
                    onAdvance={advance}
                    onCancelClick={setCancelling}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <section className="mt-2 rounded-3xl border border-line bg-card/60 p-4">
        <header className="mb-3 flex items-center gap-2">
          <span className="text-sm font-black">{STATUS_LABELS.cancelled}</span>
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-600">
            {grouped.cancelled.length}
          </span>
        </header>
        {grouped.cancelled.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">لا طلبات ملغاة</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.cancelled.map((o) => (
              <li key={o.id} className="rounded-2xl border border-line bg-background p-3.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-xs font-black text-red-600">
                    #{o.id}
                  </span>
                  <span className="text-sm font-black text-muted line-through">
                    {formatPrice(o.totalCents)}
                  </span>
                </div>
                <p className="text-xs font-bold text-red-500">{o.cancelReason || "تم الإلغاء"}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {o.cancelledAt
                    ? new Date(o.cancelledAt).toLocaleString("ar", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cancelling && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCancelling(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-line bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black">إلغاء الطلب #{cancelling.id}</h3>
            <p className="mt-1 text-sm text-muted">اختر سبب الإلغاء (اختياري)</p>
            <div className="mt-4 grid gap-2">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => doCancel(r)}
                  disabled={busy}
                  className="rounded-xl border border-line bg-background px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCancelling(null)}
              className="mt-4 w-full rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-muted transition-colors hover:text-foreground"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
