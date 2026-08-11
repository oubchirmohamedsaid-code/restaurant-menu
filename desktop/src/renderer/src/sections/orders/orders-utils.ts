import type {
  OgtLateThresholds,
  OgtOrder,
  OgtOrderStatus,
} from "@shared/types";
import { isLate, minutesInStage } from "@lib/orders";

export interface StageInfo {
  minutes: number | null;
  late: boolean;
}

export function stageInfo(
  order: OgtOrder,
  thresholds: OgtLateThresholds,
  now = Date.now(),
): StageInfo {
  return {
    minutes: minutesInStage(order, now),
    late: isLate(order, thresholds, now),
  };
}

export function itemCount(order: OgtOrder): number {
  try {
    const parsed = JSON.parse(order.items);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function itemsPreview(order: OgtOrder): string {
  try {
    const parsed = JSON.parse(order.items);
    if (!Array.isArray(parsed)) return "";
    const lines = parsed.map((x) => String(x));
    if (lines.length === 0) return "";
    const first = lines.slice(0, 2).join("، ");
    return lines.length > 2 ? `${first} (+${lines.length - 2})` : first;
  } catch {
    return "";
  }
}

export function phoneNumber(order: OgtOrder): string {
  return (order.customerPhone || "").replace(/[^0-9+]/g, "");
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit" });
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

export const STATUS_STYLE: Record<OgtOrderStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  preparing: "bg-amber-50 text-amber-700 border-amber-200",
  delivered: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

export const STATUS_DOT: Record<OgtOrderStatus, string> = {
  new: "bg-blue-500",
  preparing: "bg-amber-500",
  delivered: "bg-violet-500",
  completed: "bg-green-500",
  cancelled: "bg-red-500",
};

export const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-50 text-red-700 border-red-200",
  important: "bg-orange-50 text-orange-700 border-orange-200",
  normal: "bg-surface text-muted border-line",
};
