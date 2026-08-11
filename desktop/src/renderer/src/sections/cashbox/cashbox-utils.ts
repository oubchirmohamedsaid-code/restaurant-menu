export type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "month" | "year" | "all";

export const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "اليوم" },
  { key: "yesterday", label: "أمس" },
  { key: "7d", label: "هذا الأسبوع" },
  { key: "30d", label: "30 يوماً" },
  { key: "month", label: "هذا الشهر" },
  { key: "year", label: "هذا العام" },
  { key: "all", label: "الكل" },
];

export function periodRange(key: PeriodKey): { from: number; to: number } {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrow = dayStart + 86400000;
  switch (key) {
    case "today":
      return { from: dayStart, to: tomorrow - 1 };
    case "yesterday": {
      const y = dayStart - 86400000;
      return { from: y, to: dayStart - 1 };
    }
    case "7d":
      return { from: dayStart - 6 * 86400000, to: tomorrow - 1 };
    case "30d":
      return { from: dayStart - 29 * 86400000, to: tomorrow - 1 };
    case "month": {
      const m = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return { from: m, to: next - 1 };
    }
    case "year": {
      const y0 = new Date(now.getFullYear(), 0, 1).getTime();
      const y1 = new Date(now.getFullYear() + 1, 0, 1).getTime();
      return { from: y0, to: y1 - 1 };
    }
    case "all":
      return { from: 0, to: Number.MAX_SAFE_INTEGER };
  }
}

export function parseDinarToCents(input: string): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? m[2].padEnd(2, "0") : "00";
  return whole * 100 + parseInt(frac, 10);
}

export function centsToDinarInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(n / 100);
}
