import { useMemo, useState } from "react";
import {
  X,
  Phone,
  Copy,
  MessageCircle,
  MapPin,
  StickyNote,
  Check,
  CircleCheck,
  XCircle,
  CookingPot,
  Bike,
  ImageOff,
  Wallet,
} from "lucide-react";
import type {
  OgtCashboxTx,
  OgtLateThresholds,
  OgtOrder,
  OgtOrderDetail,
  OgtOrderPriority,
  OgtOrderStatus,
} from "@shared/types";
import { ACTIVITY_LABELS, PRIORITIES, PRIORITY_LABELS, STATUS_LABELS } from "@lib/orders";
import { formatMoney, formatRelative } from "../../format";
import { formatDateTime, phoneNumber, STATUS_STYLE, PRIORITY_STYLE } from "./orders-utils";

function parseNames(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export function OrderDetailPanel({
  detail,
  thresholds,
  products,
  canManage,
  busy,
  cashboxTx,
  onOpenCashbox,
  onClose,
  onAdvance,
  onCancel,
  onPriority,
  onTogglePayment,
  onToast,
}: {
  detail: OgtOrderDetail;
  thresholds: OgtLateThresholds;
  products: Map<number, string>;
  canManage: boolean;
  busy: boolean;
  cashboxTx?: OgtCashboxTx;
  onOpenCashbox?: (txId: number) => void;
  onClose: () => void;
  onAdvance: (id: number, to: OgtOrderStatus) => void;
  onCancel: (order: OgtOrder) => void;
  onPriority: (id: number, p: OgtOrderPriority) => void;
  onTogglePayment: (id: number) => void;
  onToast: (msg: string) => void;
}) {
  const { order, lines, activity } = detail;
  const [priorityBusy, setPriorityBusy] = useState(false);
  const cancelled = order.status === "cancelled";
  const completed = order.status === "completed";
  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0);
  const grandTotal = subtotal - order.discountCents + order.deliveryFeeCents;
  const phone = phoneNumber(order);
  const isLate = useMemo(() => {
    if (order.status === "completed" || order.status === "cancelled") return false;
    const start =
      order.status === "new"
        ? order.createdAt
        : order.status === "preparing"
          ? order.preparingAt
          : order.deliveredAt;
    if (start == null) return false;
    const limit =
      thresholds[order.status as "new" | "preparing" | "delivered"] ??
      (order.status === "new" ? 15 : order.status === "preparing" ? 30 : 20);
    return Date.now() - start > limit * 60000;
  }, [order, thresholds]);

  const steps = [
    { key: "created", at: order.createdAt, label: "طلب جديد", icon: Check },
    { key: "confirmed", at: order.confirmedAt, label: "تم التأكيد", icon: CookingPot },
    { key: "preparing", at: order.preparingAt, label: "قيد التحضير", icon: CookingPot },
    { key: "delivered", at: order.deliveredAt, label: "تم التوصيل", icon: Bike },
    { key: "completed", at: order.completedAt, label: "مكتمل", icon: CircleCheck },
    { key: "cancelled", at: order.cancelledAt, label: "ملغى", icon: XCircle, danger: true },
  ].filter((s) => s.at != null);

  async function openExternal(url: string) {
    try {
      await window.ogt.app.openExternal(url);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "تعذر فتح الرابط");
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await window.ogt.app.copyText(text);
      onToast(`${label} تم نسخه`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "تعذر النسخ");
    }
  }

  async function handlePriority(p: OgtOrderPriority) {
    setPriorityBusy(true);
    try {
      await onPriority(order.id, p);
    } finally {
      setPriorityBusy(false);
    }
  }

  const nextTo: { to: OgtOrderStatus; label: string; icon: typeof Check } | null =
    order.status === "new"
      ? { to: "preparing", label: "تأكيد الطلب", icon: CookingPot }
      : order.status === "preparing"
        ? { to: "delivered", label: "تم التوصيل", icon: Bike }
        : order.status === "delivered"
          ? { to: "completed", label: "إكمال الطلب", icon: CircleCheck }
          : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-sm font-black text-accent-strong">
            #{order.id}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-foreground">{STATUS_LABELS[order.status]}</p>
              {order.priority !== "normal" && (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black ${PRIORITY_STYLE[order.priority]}`}
                >
                  {PRIORITY_LABELS[order.priority as keyof typeof PRIORITY_LABELS] ?? order.priority}
                </span>
              )}
              {isLate && (
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600">
                  متأخر
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-muted">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-2 hover:text-foreground"
          aria-label="إغلاق"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {!cancelled && !completed && (
          <div className="flex flex-wrap gap-2">
            {nextTo && (
              <button
                onClick={() => onAdvance(order.id, nextTo.to)}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                <nextTo.icon className="size-4" />
                {nextTo.label}
              </button>
            )}
            {canManage && (
              <button
                onClick={() => onCancel(order)}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle className="size-4" />
                إلغاء الطلب
              </button>
            )}
          </div>
        )}

        {order.customerName || order.customerPhone || order.customerAddress || order.notes ? (
          <section className="space-y-2 rounded-2xl border border-line bg-surface p-4 shadow-soft">
            <h3 className="text-xs font-black text-muted">الزبون</h3>
            {order.customerName && (
              <p className="text-sm font-black text-foreground">{order.customerName}</p>
            )}
            {phone && (
              <div className="flex flex-wrap items-center gap-2">
                <span dir="ltr" className="text-sm font-bold text-foreground">
                  {phone}
                </span>
                <button
                  onClick={() => openExternal(`tel:${phone}`)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground"
                >
                  <Phone className="size-3" />
                  اتصال
                </button>
                <button
                  onClick={() => copyText(phone, "رقم الهاتف")}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground"
                >
                  <Copy className="size-3" />
                  نسخ
                </button>
                <button
                  onClick={() => openExternal(`https://wa.me/${phone.replace(/^\+/, "")}`)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground"
                >
                  <MessageCircle className="size-3" />
                  واتساب
                </button>
              </div>
            )}
            {order.customerAddress && (
              <p className="flex items-start gap-1.5 text-xs font-semibold text-muted">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                {order.customerAddress}
              </p>
            )}
            {order.notes && (
              <p className="flex items-start gap-1.5 text-xs font-semibold text-muted">
                <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                {order.notes}
              </p>
            )}
          </section>
        ) : null}

        <section>
          <h3 className="mb-2 text-xs font-black text-muted">البنود</h3>
          <ul className="space-y-2">
            {lines.map((l) => {
              const image = products.get(l.productId);
              return (
                <li key={l.id} className="flex gap-3 rounded-xl border border-line bg-surface p-3 shadow-soft">
                  {image ? (
                    <img
                      src={image}
                      alt={l.name}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-card-2 text-muted">
                      <ImageOff className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-foreground">
                      {l.name} × {l.qty}
                    </p>
                    {parseNames(l.extras).length > 0 && (
                      <p className="text-xs font-semibold text-muted">
                        + {parseNames(l.extras).join("، ")}
                      </p>
                    )}
                    {parseNames(l.removed).length > 0 && (
                      <p className="text-xs font-semibold text-muted">
                        بدون: {parseNames(l.removed).join("، ")}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-black text-accent-strong tabular-nums">
                    {formatMoney(l.lineCents)} دج
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-1 rounded-xl border border-line bg-surface p-3 text-sm shadow-soft">
          <p className="flex justify-between">
            <span className="text-muted">المجموع</span>
            <span className="font-bold tabular-nums">{formatMoney(subtotal)} دج</span>
          </p>
          {order.deliveryFeeCents > 0 && (
            <p className="flex justify-between">
              <span className="text-muted">التوصيل</span>
              <span className="font-bold tabular-nums">{formatMoney(order.deliveryFeeCents)} دج</span>
            </p>
          )}
          {order.discountCents > 0 && (
            <p className="flex justify-between text-red-600">
              <span>الخصم</span>
              <span className="font-bold tabular-nums">- {formatMoney(order.discountCents)} دج</span>
            </p>
          )}
          <p className="flex justify-between border-t border-line pt-2 text-base font-black">
            <span className="text-foreground">الإجمالي</span>
            <span className="tabular-nums text-accent-strong">{formatMoney(grandTotal)} دج</span>
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-black text-muted">الأولوية والدفع</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={order.priority}
              disabled={!canManage || priorityBusy}
              onChange={(e) => void handlePriority(e.target.value as OgtOrderPriority)}
              className="h-9 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <button
              onClick={() => onTogglePayment(order.id)}
              disabled={!canManage || busy}
              className={`h-9 rounded-xl px-4 text-sm font-extrabold transition-colors disabled:opacity-50 ${
                order.paymentStatus === "paid"
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "border border-line text-muted hover:bg-card-2"
              }`}
            >
              {order.paymentStatus === "paid" ? "مدفوع" : "غير مدفوع"}
            </button>
            {order.paidAt != null && (
              <span className="text-xs font-semibold text-muted">
                دفع: {formatDateTime(order.paidAt)}
              </span>
            )}
            {cashboxTx && onOpenCashbox && (
              <button
                onClick={() => onOpenCashbox(cashboxTx.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 text-xs font-black text-accent-strong transition-colors hover:bg-accent/20"
              >
                <Wallet className="size-4" />
                عرض في صندوق النقود
              </button>
            )}
          </div>
          {!canManage && (
            <p className="mt-1.5 text-[11px] font-semibold text-muted">
              تغيير الأولوية والدفع متاح للمدير أو المالك فقط
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-black text-muted">مسار الطلب</h3>
          <ol className="space-y-1">
            {steps.map((s) => (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    s.danger ? "bg-red-100 text-red-600" : "bg-accent/15 text-accent-strong"
                  }`}
                >
                  <s.icon className="size-3.5" />
                </span>
                <span className="flex-1 text-sm font-bold text-foreground">{s.label}</span>
                <span className="text-xs font-semibold text-muted">
                  {formatDateTime(s.at as number)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {activity.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-black text-muted">النشاط</h3>
            <ul className="space-y-1.5">
              {[...activity].reverse().map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 text-xs">
                  <span className="font-bold text-foreground">
                    {ACTIVITY_LABELS[a.action] ?? a.action}
                    <span className="ms-1.5 font-semibold text-muted">· {a.actor}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-muted">
                    {formatRelative(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {order.status === "cancelled" && order.cancelReason && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
            سبب الإلغاء: {order.cancelReason}
          </p>
        )}
      </div>

      <footer className="border-t border-line px-5 py-3 text-[11px] font-semibold text-muted">
        آخر تحديث: {formatRelative(order.updatedAt)}
      </footer>
    </div>
  );
}
