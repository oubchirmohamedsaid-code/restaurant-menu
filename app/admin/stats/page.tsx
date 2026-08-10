import { redirect } from "next/navigation";
import { listOrders, listAllOrderLines } from "@/lib/db";
import { computeStats } from "@/lib/stats";
import { KpiCard, TrendChart, DonutChart, TopProductsChart, formatCents } from "@/components/stats-charts";
import { PRIORITY_LABELS } from "@/lib/orders";
import { isAdmin } from "../actions";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  if (!(await isAdmin())) redirect("/admin");
  const [orders, lines] = await Promise.all([listOrders(), listAllOrderLines()]);
  const stats = computeStats(orders, lines);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-black">الإحصائيات</h1>
        <p className="mt-1 text-sm text-muted">نظرة عامة على الطلبات والإيرادات</p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="طلبات اليوم"
          value={String(stats.last7Days[stats.last7Days.length - 1].orders)}
          accent="var(--color-accent, #eab308)"
        />
        <KpiCard
          label="إيراد اليوم"
          value={formatCents(stats.last7Days[stats.last7Days.length - 1].revenueCents)}
          accent="#22c55e"
        />
        <KpiCard label="طلبات نشطة" value={String(stats.activeOrders)} accent="#3b82f6" />
        <KpiCard label="غير مدفوعة" value={String(stats.unpaidOrders)} accent="#f59e0b" />
        <KpiCard label="متوسط قيمة الطلب" value={formatCents(stats.avgOrderCents)} accent="#a78bfa" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-card p-5">
          <h2 className="mb-4 text-lg font-extrabold">الطلبات — آخر 7 أيام</h2>
          <TrendChart data={stats.last7Days} color="#3b82f6" />
        </section>
        <section className="rounded-3xl border border-line bg-card p-5">
          <h2 className="mb-4 text-lg font-extrabold">الإيراد — آخر 7 أيام</h2>
          <RevenueChart data={stats.last7Days} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-card p-5">
          <h2 className="mb-4 text-lg font-extrabold">توزيع الطلبات حسب الحالة</h2>
          <DonutChart data={stats.byStatus} />
        </section>
        <section className="rounded-3xl border border-line bg-card p-5">
          <h2 className="mb-4 text-lg font-extrabold">الأطباق الأكثر طلباً</h2>
          <TopProductsChart data={stats.topProducts} />
        </section>
      </div>

      <div className="mt-6 rounded-3xl border border-line bg-card p-5">
        <h2 className="mb-4 text-lg font-extrabold">الأولويات</h2>
        <div className="flex flex-wrap gap-3">
          {stats.byPriority.map((p) => (
            <span key={p.priority} className="rounded-full border border-line px-4 py-2 text-sm font-bold">
              {PRIORITY_LABELS[p.priority]}: <span className="text-accent-strong">{p.count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RevenueChart({ data }: { data: { key: string; label: string; revenueCents: number }[] }) {
  const W = 320;
  const H = 160;
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="مخطط الإيراد آخر 7 أيام">
      <path d={area} fill="#22c55e" fillOpacity={0.12} />
      <path d={line} fill="none" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#22c55e" />
      ))}
      {data.map((d, i) => (
        <text key={d.key} x={points[i].x} y={H - 6} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
          {d.label}
        </text>
      ))}
      <text x={padL} y={padT - 2} fontSize={8} fill="currentColor" fillOpacity={0.5}>
        {formatCents(max)}
      </text>
    </svg>
  );
}
