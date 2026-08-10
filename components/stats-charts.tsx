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

export function TrendChart({
  data,
  color,
  height = 160,
}: {
  data: DayStat[];
  color: string;
  height?: number;
}) {
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
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
      ))}
      {data.map((d, i) => (
        <text key={d.key} x={points[i].x} y={H - 6} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
          {d.label}
        </text>
      ))}
    </svg>
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

export function TopProductsChart({ data }: { data: TopProduct[] }) {
  const maxQty = Math.max(...data.map((d) => d.qty), 1);
  const W = 320;
  const rowH = 34;
  const H = data.length * rowH;
  const barMaxW = 150;
  const barX = 92;
  const labelW = 82;

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">لا توجد طلبات بعد لعرض الأطباق المطلوبة</p>;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="الأطباق الأكثر طلباً">
      {data.map((d, i) => {
        const y = i * rowH + 6;
        const bw = Math.max((d.qty / maxQty) * barMaxW, 6);
        return (
          <g key={d.name}>
            <text x={barX - 6} y={y + 10} fontSize={10} fontWeight={700} textAnchor="end" fill="currentColor" style={{ maxWidth: labelW }}>
              {d.name.length > 18 ? `${d.name.slice(0, 18)}…` : d.name}
            </text>
            <rect x={barX} y={y} width={bw} height={12} rx={3} fill="var(--color-accent, #eab308)" fillOpacity={0.85} />
            <text x={barX + bw + 6} y={y + 10} fontSize={9} fill="currentColor" fillOpacity={0.7}>
              ×{d.qty}
            </text>
          </g>
        );
      })}
    </svg>
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
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black" style={{ color: accent }}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function formatCents(cents: number): string {
  return formatPrice(cents);
}
