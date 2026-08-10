"use client";

import { useState } from "react";
import Image from "next/image";
import type { DayStat, StatusStat, TopProduct } from "@/lib/stats";
import { STATUS_LABELS } from "@/lib/orders";
import { formatPrice } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  new: "#f59e0b",
  preparing: "#3b82f6",
  delivered: "#14b8a6",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

function useChartHover() {
  const [active, setActive] = useState<number | null>(null);
  return { active, setActive };
}

function Tooltip({
  left,
  top,
  children,
}: {
  left: number;
  top: number;
  children: React.ReactNode;
}) {
  const clampedLeft = Math.min(Math.max(left, 12), 88);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-bold shadow-card"
      style={{ left: `${clampedLeft}%`, top: `${top}%` }}
    >
      {children}
    </div>
  );
}

export function TrendChart({
  data,
  color,
  height = 160,
}: {
  data: DayStat[];
  color: string;
  height?: number;
}) {
  const { active, setActive } = useChartHover();
  const W = 320;
  const H = height;
  const padL = 4;
  const padR = 4;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.orders), 1);
  const n = data.length;
  const points = data.map((d, i) => {
    const x = n === 1 ? padL + plotW / 2 : padL + (i * plotW) / (n - 1);
    const y = padT + plotH - (d.orders / max) * plotH;
    return { x, y };
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${points[points.length - 1].x},${padT + plotH} L${points[0].x},${padT + plotH} Z`;
  const gridY = [0, 0.5, 1].map((f) => padT + plotH - f * plotH);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="مخطط الطلبات آخر 7 أيام">
        {gridY.map((y) => (
          <line key={y} x1={padL} x2={W - padR} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} />
        ))}
        <text x={padL} y={padT - 2} fontSize={8} fill="currentColor" fillOpacity={0.5}>
          {max}
        </text>
        <path d={area} fill={color} fillOpacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={active === i ? 5 : 2.5} fill={color} />
        ))}
        {active != null && (
          <line
            x1={points[active].x}
            x2={points[active].x}
            y1={padT}
            y2={padT + plotH}
            stroke={color}
            strokeOpacity={0.4}
            strokeDasharray="3 3"
          />
        )}
        {data.map((d, i) => (
          <text key={d.key} x={points[i].x} y={H - 6} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
            {d.label}
          </text>
        ))}
        {data.map((d, i) => {
          const midBefore = i === 0 ? padL : (points[i - 1].x + points[i].x) / 2;
          const midAfter = i === n - 1 ? W - padR : (points[i + 1].x + points[i].x) / 2;
          return (
            <rect
              key={`hit-${d.key}`}
              x={midBefore}
              y={padT}
              width={midAfter - midBefore}
              height={padT + plotH - padT}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            />
          );
        })}
      </svg>
      {active != null && (
        <Tooltip left={(points[active].x / W) * 100} top={(points[active].y / H) * 100}>
          <span className="text-muted">{data[active].label}</span>{" "}
          <span style={{ color }}>{data[active].orders} طلب</span>
        </Tooltip>
      )}
    </div>
  );
}

export function RevenueChart({
  data,
  height = 160,
}: {
  data: DayStat[];
  height?: number;
}) {
  const { active, setActive } = useChartHover();
  const W = 320;
  const H = height;
  const padL = 4;
  const padR = 4;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.revenueCents), 1);
  const n = data.length;
  const points = data.map((d, i) => {
    const x = n === 1 ? padL + plotW / 2 : padL + (i * plotW) / (n - 1);
    const y = padT + plotH - (d.revenueCents / max) * plotH;
    return { x, y };
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${points[points.length - 1].x},${padT + plotH} L${points[0].x},${padT + plotH} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="مخطط الإيراد آخر 7 أيام">
        {[0, 0.5, 1].map((f) => {
          const y = padT + plotH - f * plotH;
          return <line key={y} x1={padL} x2={W - padR} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} />;
        })}
        <text x={padL} y={padT - 2} fontSize={8} fill="currentColor" fillOpacity={0.5}>
          {formatPrice(max)}
        </text>
        <path d={area} fill="#22c55e" fillOpacity={0.12} />
        <path d={line} fill="none" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={active === i ? 5 : 2.5} fill="#22c55e" />
        ))}
        {active != null && (
          <line
            x1={points[active].x}
            x2={points[active].x}
            y1={padT}
            y2={padT + plotH}
            stroke="#22c55e"
            strokeOpacity={0.4}
            strokeDasharray="3 3"
          />
        )}
        {data.map((d, i) => (
          <text key={d.key} x={points[i].x} y={H - 6} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
            {d.label}
          </text>
        ))}
        {data.map((d, i) => {
          const midBefore = i === 0 ? padL : (points[i - 1].x + points[i].x) / 2;
          const midAfter = i === n - 1 ? W - padR : (points[i + 1].x + points[i].x) / 2;
          return (
            <rect
              key={`hit-${d.key}`}
              x={midBefore}
              y={padT}
              width={midAfter - midBefore}
              height={padT + plotH - padT}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            />
          );
        })}
      </svg>
      {active != null && (
        <Tooltip left={(points[active].x / W) * 100} top={(points[active].y / H) * 100}>
          <span className="text-muted">{data[active].label}</span>{" "}
          <span style={{ color: "#22c55e" }}>{formatPrice(data[active].revenueCents)}</span>
        </Tooltip>
      )}
    </div>
  );
}

export function DonutChart({ data, height = 180 }: { data: StatusStat[]; height?: number }) {
  const W = 200;
  const H = height;
  const cx = 60;
  const cy = H / 2;
  const r = 42;
  const C = 2 * Math.PI * r;
  const total = Math.max(data.reduce((s, d) => s + d.count, 0), 1);
  const segments = data.map((d, i) => {
    const before = data.slice(0, i).reduce((sum, x) => sum + x.count, 0);
    const frac = d.count / total;
    return {
      status: d.status,
      dash: `${Math.max(frac * C - 2, 0.01)} ${C}`,
      rotate: (before / total) * 360 - 90,
    };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-32 shrink-0" role="img" aria-label="توزيع الطلبات حسب الحالة">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={16} />
        {segments.map((s) => (
          <circle
            key={s.status}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={STATUS_COLORS[s.status] ?? "#888"}
            strokeWidth={16}
            strokeDasharray={s.dash}
            transform={`rotate(${s.rotate} ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 2} fontSize={16} fontWeight={800} textAnchor="middle" fill="currentColor">
          {data.reduce((s, d) => s + d.count, 0)}
        </text>
        <text x={cx} y={cy + 14} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
          طلب
        </text>
      </svg>
      <ul className="flex-1 space-y-1.5">
        {data.map((d) => (
          <li key={d.status} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-bold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[d.status] ?? "#888" }} />
              {STATUS_LABELS[d.status]}
            </span>
            <span className="text-muted">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TopProductsChart({
  data,
  images,
}: {
  data: TopProduct[];
  images?: Record<number, string>;
}) {
  const maxQty = Math.max(...data.map((d) => d.qty), 1);

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">لا توجد طلبات بعد لعرض الأطباق المطلوبة</p>;
  }

  return (
    <ol className="space-y-2.5">
      {data.map((d, i) => {
        const img = images?.[d.productId];
        const pct = Math.round((d.qty / maxQty) * 100);
        return (
          <li key={`${d.productId}-${d.name}`} className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-xs font-black text-accent-strong">
              {i + 1}
            </span>
            {img ? (
              <Image src={img} alt={d.name} width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-lg font-black text-muted">
                {i + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-bold">{d.name}</span>
                <span className="shrink-0 text-xs font-black text-accent-strong">×{d.qty}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-accent/70 transition-all" style={{ width: `${Math.max(pct, 4)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{formatPrice(d.revenueCents)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card-2/70 p-4 shadow-soft">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black" style={{ color: accent }}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
