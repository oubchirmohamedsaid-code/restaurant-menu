"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  cancelOrderAction,
  completeOrderAction,
  confirmOrderAction,
  getOrderDetailAction,
  markDeliveredAction,
  reorderOrderAction,
  setOrderPaymentStatusAction,
  setOrderPriorityAction,
} from "@/app/admin/actions";
import type { ActionResult } from "@/app/admin/actions";
import type { OrderDetail, OrderRow } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import {
  activityLabel,
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

function itemCount(itemsJson: string): number {
  try {
    const parsed = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function safeNames(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
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

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" });
}

function OrderCard({
  order,
  thresholds,
  busy,
  onOpen,
  onAdvance,
  onCancelClick,
}: {
  order: OrderRow;
  thresholds: LateThresholds;
  busy: boolean;
  onOpen: (id: number) => void;
  onAdvance: (orderId: number, action: "confirm" | "deliver" | "complete") => void;
  onCancelClick: (order: OrderRow) => void;
}) {
  const late = isLate(order, thresholds);
  const minutes = minutesInStage(order);
  const cancelled = order.status === "cancelled";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(order.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(order.id);
      }}
      className={`cursor-pointer rounded-2xl border bg-background p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
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
        <p className="text-[11px] font-bold text-muted">{formatTime(order.createdAt)}</p>
        <p className="text-base font-black text-accent">{formatPrice(order.totalCents)}</p>
      </div>

      {cancelled ? (
        <p className="text-xs text-muted">{order.cancelReason || "تم الإلغاء"}</p>
      ) : (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted">{itemCount(order.items)} صنف</p>
          {minutes !== null && (
            <p className={`text-[11px] font-extrabold ${late ? "text-red-500" : "text-muted"}`}>
              {late ? `⚠️ متأخر · ${minutes} د` : `${minutes} د`}
            </p>
          )}
        </div>
      )}

      {!cancelled && order.status !== "completed" && (
        <div
          className="flex flex-wrap gap-1.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
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

function OrderDetailPanel({
  detail,
  busy,
  onClose,
  onAdvance,
  onCancelClick,
  onChanged,
}: {
  detail: OrderDetail;
  busy: boolean;
  onClose: () => void;
  onAdvance: (orderId: number, action: "confirm" | "deliver" | "complete") => void;
  onCancelClick: (order: OrderRow) => void;
  onChanged: () => void;
}) {
  const { order, lines } = detail;
  const cancelled = order.status === "cancelled";
  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0);
  const grandTotal = subtotal - order.discountCents + order.deliveryFeeCents;
  const hasCustomer = Boolean(
    order.customerName || order.customerPhone || order.customerAddress || order.notes,
  );

  const steps = [
    { key: "created", at: order.createdAt, label: "طلب جديد" },
    { key: "confirmed", at: order.confirmedAt, label: "تم التأكيد" },
    { key: "preparing", at: order.preparingAt, label: "قيد التحضير" },
    { key: "delivered", at: order.deliveredAt, label: "تم التوصيل" },
    { key: "completed", at: order.completedAt, label: "مكتمل" },
    { key: "cancelled", at: order.cancelledAt, label: "ملغى", danger: true },
  ].filter((s) => s.at != null) as Array<{ key: string; at: number; label: string; danger?: boolean }>;

  async function setPriority(priority: OrderPriority) {
    await setOrderPriorityAction(order.id, priority);
    onChanged();
  }

  async function togglePaid() {
    await setOrderPaymentStatusAction(order.id, order.paymentStatus === "paid" ? "unpaid" : "paid");
    onChanged();
  }

  async function reorder() {
    await reorderOrderAction(order.id);
    onChanged();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-sm font-black text-accent-strong">
            #{order.id}
          </span>
          <div>
            <p className="text-sm font-black">{STATUS_LABELS[order.status]}</p>
            <p className="text-xs text-muted">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:text-foreground"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {!cancelled && order.status !== "completed" && (
          <div className="flex flex-wrap gap-2">
            {order.status === "new" && (
              <CardButton kind="primary" onClick={() => onAdvance(order.id, "confirm")} disabled={busy}>
                تأكيد الطلب
              </CardButton>
            )}
            {order.status === "preparing" && (
              <CardButton kind="primary" onClick={() => onAdvance(order.id, "deliver")} disabled={busy}>
                تم التوصيل
              </CardButton>
            )}
            {order.status === "delivered" && (
              <CardButton kind="primary" onClick={() => onAdvance(order.id, "complete")} disabled={busy}>
                إكمال الطلب
              </CardButton>
            )}
            <CardButton kind="danger" onClick={() => onCancelClick(order)} disabled={busy}>
              إلغاء الطلب
            </CardButton>
          </div>
        )}

        <section>
          <h3 className="mb-2 text-xs font-black text-muted">البنود</h3>
          <ul className="space-y-2">
            {lines.map((l) => (
              <li key={l.id} className="rounded-xl border border-line bg-background p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">
                      {l.name} × {l.qty}
                    </p>
                    {safeNames(l.extras).length > 0 && (
                      <p className="text-xs text-muted">+ {safeNames(l.extras).join("، ")}</p>
                    )}
                    {safeNames(l.removed).length > 0 && (
                      <p className="text-xs text-muted">بدون: {safeNames(l.removed).join("، ")}</p>
                    )}
                  </div>
                  <span className="font-black">{formatPrice(l.lineCents)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-1 rounded-xl border border-line bg-background p-3 text-sm">
          <p className="flex justify-between">
            <span className="text-muted">المجموع</span>
            <span className="font-bold">{formatPrice(subtotal)}</span>
          </p>
          {order.deliveryFeeCents > 0 && (
            <p className="flex justify-between">
              <span className="text-muted">التوصيل</span>
              <span className="font-bold">{formatPrice(order.deliveryFeeCents)}</span>
            </p>
          )}
          {order.discountCents > 0 && (
            <p className="flex justify-between text-red-600">
              <span>الخصم</span>
              <span className="font-bold">- {formatPrice(order.discountCents)}</span>
            </p>
          )}
          <p className="flex justify-between border-t border-line pt-2 text-base font-black">
            <span>الإجمالي</span>
            <span className="text-accent-strong">{formatPrice(grandTotal)}</span>
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-black text-muted">الأولوية والدفع</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={order.priority}
              onChange={(e) => void setPriority(e.target.value as OrderPriority)}
              className="rounded-xl border border-line bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void togglePaid()}
              className={`rounded-full px-4 py-2 text-sm font-extrabold transition-colors ${
                order.paymentStatus === "paid"
                  ? "bg-green-100 text-green-700"
                  : "border border-line text-muted"
              }`}
            >
              {order.paymentStatus === "paid" ? "مدفوع ✓" : "غير مدفوع"}
            </button>
          </div>
        </section>

        {hasCustomer && (
          <section>
            <h3 className="mb-2 text-xs font-black text-muted">الزبون</h3>
            <div className="space-y-1 rounded-xl border border-line bg-background p-3 text-sm">
              {(order.customerName || order.customerPhone) && (
                <p className="font-bold">
                  {order.customerName || "—"}
                  {order.customerPhone && <span className="text-muted"> ({order.customerPhone})</span>}
                </p>
              )}
              {order.customerAddress && <p>{order.customerAddress}</p>}
              {order.notes && <p className="text-muted">{order.notes}</p>}
            </div>
          </section>
        )}

        {cancelled && (
          <section className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-600">
            ملغى — {order.cancelReason || "بدون سبب"}
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-black text-muted">المسار الزمني</h3>
          <ol className="relative space-y-3 border-s-2 border-line ps-4">
            {steps.map((s) => (
              <li key={s.key} className="relative">
                <span
                  className={`absolute -start-[22px] top-1 h-3 w-3 rounded-full ring-2 ring-card ${
                    s.danger ? "bg-red-500" : "bg-accent"
                  }`}
                />
                <p className={`text-sm font-extrabold ${s.danger ? "text-red-600" : ""}`}>{s.label}</p>
                <p className="text-xs text-muted">{formatDateTime(s.at)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-black text-muted">سجل النشاط</h3>
          <ul className="space-y-1.5">
            {detail.activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-bold">{activityLabel(a.action)}</p>
                  {a.detail && a.detail !== activityLabel(a.action) && (
                    <p className="text-xs text-muted">{a.detail}</p>
                  )}
                </div>
                <span className="whitespace-nowrap text-xs text-muted">{formatTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="flex items-center gap-2 border-t border-line px-5 py-4">
        {order.status === "completed" && (
          <button
            type="button"
            onClick={() => void reorder()}
            disabled={busy}
            className="rounded-full bg-accent px-5 py-2 text-sm font-extrabold text-black transition-transform active:scale-95 disabled:opacity-50"
          >
            إعادة الطلب
          </button>
        )}
        <Link
          href={`/print/${order.id}`}
          target="_blank"
          className="rounded-full border border-line px-5 py-2 text-sm font-bold text-muted transition-colors hover:text-foreground"
        >
          طباعة 🖨️
        </Link>
      </footer>
    </div>
  );
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
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  function openDetail(id: number) {
    setLoadingDetail(true);
    setDetail(null);
    void getOrderDetailAction(id)
      .then((d) => setDetail(d ?? null))
      .finally(() => setLoadingDetail(false));
  }

  function refreshDetail() {
    if (!detail) return;
    const id = detail.order.id;
    void getOrderDetailAction(id).then((d) => {
      if (d) setDetail(d);
      router.refresh();
    });
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
    ).then(() => refreshDetail());
  }

  function doCancel(reason: string) {
    if (!cancelling) return;
    const id = cancelling.id;
    setCancelling(null);
    void run(() => cancelOrderAction(id, reason)).then(() => refreshDetail());
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
          <a
            href="/admin/orders/export"
            className="rounded-full border border-line px-4 py-2 text-sm font-bold text-muted transition-colors hover:text-foreground"
          >
            تصدير CSV
          </a>
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
                    onOpen={openDetail}
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
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => openDetail(o.id)}
                  className="w-full rounded-2xl border border-line bg-background p-3.5 text-start transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
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
                    {o.cancelledAt ? formatDateTime(o.cancelledAt) : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AnimatePresence>
        {(detail || loadingDetail) && (
          <motion.div
            key="detail-overlay"
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetail(null)}
          >
            <motion.aside
              className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-card shadow-2xl"
              initial={{ x: 48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 48, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
            >
              {detail ? (
                <OrderDetailPanel
                  detail={detail}
                  busy={busy}
                  onClose={() => setDetail(null)}
                  onAdvance={advance}
                  onCancelClick={setCancelling}
                  onChanged={refreshDetail}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center text-muted">
                  جارٍ تحميل الطلب…
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {cancelling && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
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
