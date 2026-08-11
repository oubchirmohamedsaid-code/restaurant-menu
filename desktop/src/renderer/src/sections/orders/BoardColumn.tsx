import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { OgtLateThresholds, OgtOrder, OgtOrderStatus } from "@shared/types";
import { STATUS_LABELS } from "@lib/orders";
import { STATUS_DOT } from "./orders-utils";
import { SortableOrderCard } from "./OrderCard";

export function BoardColumn({
  status,
  orders,
  thresholds,
  onOpen,
}: {
  status: OgtOrderStatus;
  orders: OgtOrder[];
  thresholds: OgtLateThresholds;
  onOpen: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  let body: ReactNode;
  if (orders.length === 0) {
    body = (
      <div className="flex min-h-24 items-center justify-center">
        <p className="text-xs font-bold text-muted">لا طلبات</p>
      </div>
    );
  } else {
    body = (
      <SortableContext items={orders.map((o) => String(o.id))}>
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <SortableOrderCard
              key={o.id}
              order={o}
              thresholds={thresholds}
              onOpen={onOpen}
              draggable={o.status !== "cancelled"}
            />
          ))}
        </div>
      </SortableContext>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`relative flex w-72 shrink-0 flex-col rounded-2xl border bg-card-2/70 p-3 transition-all duration-200 ${
        isOver ? "border-accent/70 bg-accent/5 shadow-card" : "border-line"
      }`}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <span className="flex items-center gap-2 text-sm font-black">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
          {STATUS_LABELS[status]}
        </span>
        <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-black text-accent-strong tabular-nums">
          {orders.length}
        </span>
      </header>
      <div className="min-h-24 flex-1 overflow-y-auto pb-1 pe-1">{body}</div>
      {isOver && (
        <div className="pointer-events-none absolute inset-2 rounded-xl border-2 border-dashed border-accent/60" />
      )}
    </div>
  );
}
