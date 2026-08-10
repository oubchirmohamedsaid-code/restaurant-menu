import type { OrderRow } from "./db";

export type OrderStatus = "new" | "preparing" | "delivered" | "completed" | "cancelled";
export type OrderPriority = "normal" | "important" | "urgent";
export type PaymentStatus = "unpaid" | "paid";
export type StageStatus = "new" | "preparing" | "delivered";

export const ORDER_STATUSES: OrderStatus[] = ["new", "preparing", "delivered", "completed", "cancelled"];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "طلب جديد",
  preparing: "قيد التحضير",
  delivered: "تم التوصيل",
  completed: "مكتمل",
  cancelled: "ملغى",
};

export const PRIORITIES: OrderPriority[] = ["normal", "important", "urgent"];

export const PRIORITY_LABELS: Record<OrderPriority, string> = {
  normal: "عادي",
  important: "مهم",
  urgent: "عاجل",
};

export const CANCEL_REASONS: string[] = [
  "الزبون ألغى الطلب",
  "لا يمكن الوصول للزبون",
  "المنتج غير متوفر",
  "خطأ في الطلب",
  "العنوان غير صحيح",
  "سبب آخر",
];

export const DEFAULT_LATE_MINUTES: Record<StageStatus, number> = {
  new: 15,
  preparing: 30,
  delivered: 20,
};

export const STAGE_TIMESTAMP: Record<StageStatus, "createdAt" | "preparingAt" | "deliveredAt"> = {
  new: "createdAt",
  preparing: "preparingAt",
  delivered: "deliveredAt",
};

type StageOrder = Pick<OrderRow, "status" | "createdAt" | "preparingAt" | "deliveredAt">;

export function stageStartTs(order: StageOrder): number | null {
  if (order.status === "new") return order.createdAt;
  if (order.status === "preparing") return order.preparingAt;
  if (order.status === "delivered") return order.deliveredAt;
  return null;
}

export function minutesInStage(order: StageOrder, now = Date.now()): number | null {
  const start = stageStartTs(order);
  return start === null ? null : Math.floor((now - start) / 60000);
}

export function isLate(
  order: StageOrder,
  thresholds: Partial<Record<StageStatus, number>>,
  now = Date.now(),
): boolean {
  const minutes = minutesInStage(order, now);
  if (minutes === null) return false;
  const limit = thresholds[order.status as StageStatus] ?? DEFAULT_LATE_MINUTES[order.status as StageStatus];
  return limit !== undefined && minutes > limit;
}

export const ACTIVITY_LABELS: Record<string, string> = {
  created: "تم إنشاء الطلب",
  confirmed: "تم تأكيد الطلب",
  preparing: "بدأ التحضير",
  delivered: "تم التوصيل",
  completed: "تم إكمال الطلب",
  cancelled: "تم إلغاء الطلب",
  priority: "تغيير الأولوية",
  payment: "تغيير حالة الدفع",
};

export function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action;
}
