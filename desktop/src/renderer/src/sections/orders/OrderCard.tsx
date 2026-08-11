import { useMemo } from "react";
import { Phone, Clock, AlertTriangle, UserRound } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import type { OgtLateThresholds, OgtOrder } from "@shared/types";
import { PRIORITY_LABELS } from "@lib/orders";
import { formatMoney, formatRelative, formatTime } from "../../format";
import {
  itemsPreview,
  phoneNumber,
  stageInfo,
  PRIORITY_STYLE,
} from "./orders-utils";

export function SortableOrderCard({
  order,
  thresholds,
  onOpen,
  draggable = true,
}: {
  order: OgtOrder;
  thresholds: OgtLateThresholds;
  onOpen: (id: number) => void;
  draggable?: boolean;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: String(order.id),
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...(draggable ? listeners : {})}
      className={`${draggable ? "touch-none" : ""} ${isDragging ? "z-10 opacity-40" : ""}`}
      onClick={() => onOpen(order.id)}
    >
      <OrderCardBody order={order} thresholds={thresholds} />
    </div>
  );
}

export function OrderCardBody({
  order,
  thresholds,
}: {
  order: OgtOrder;
  thresholds: OgtLateThresholds;
}) {
  const now = Date.now();
  const preview = useMemo(() => itemsPreview(order), [order.items]);
  const { minutes, late } = useMemo(() => stageInfo(order, thresholds, now), [order, thresholds, now]);
  const phone = phoneNumber(order);
  const isPriority = order.priority !== "normal";

  return (
    <div className="cursor-grab rounded-2xl border border-line bg-surface p-3 shadow-soft transition-shadow hover:shadow-card active:cursor-grabbing">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-card-2 px-1 text-xs font-black text-foreground tabular-nums">
            #{order.id}
          </span>
          {isPriority && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black ${PRIORITY_STYLE[order.priority]}`}
            >
              {PRIORITY_LABELS[order.priority as keyof typeof PRIORITY_LABELS] ?? order.priority}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {late && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600">
              <AlertTriangle className="size-3" />
              متأخر
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black ${
              order.paymentStatus === "paid"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-line bg-card-2 text-muted"
            }`}
          >
            {order.paymentStatus === "paid" ? "مدفوع" : "غير مدفوع"}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-sm font-bold text-foreground">
        <UserRound className="size-3.5 shrink-0 text-muted" />
        <span className="truncate">{order.customerName || "زبون بدون اسم"}</span>
      </div>
      {phone && (
        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Phone className="size-3 shrink-0" />
          <span dir="ltr">{phone}</span>
        </p>
      )}
      {preview && (
        <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-muted">{preview}</p>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <div className="flex items-center gap-2 text-[11px] font-bold text-muted">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatTime(order.createdAt)}
          </span>
          {minutes !== null && minutes > 0 && (
            <span className={late ? "font-black text-red-600" : ""}>
              {minutes} د
            </span>
          )}
          <span className="text-muted">·</span>
          <span>{formatRelative(order.createdAt, now)}</span>
        </div>
        <span className="text-sm font-black text-accent-strong tabular-nums">
          {formatMoney(order.totalCents)} دج
        </span>
      </div>
    </div>
  );
}
