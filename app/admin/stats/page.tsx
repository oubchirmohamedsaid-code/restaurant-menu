import { redirect } from "next/navigation";
import { listOrders, listAllOrderLines, listAllProducts } from "@/lib/db";
import { computeStats } from "@/lib/stats";
import { KpiCard, TrendChart, DonutChart, TopProductsChart, RevenueChart } from "@/components/stats-charts";
import { formatPrice } from "@/lib/utils";
import { PRIORITY_LABELS } from "@/lib/orders";
import { isAdmin } from "../actions";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  if (!(await isAdmin())) redirect("/admin");
  const [orders, lines, products] = await Promise.all([listOrders(), listAllOrderLines(), listAllProducts()]);
  const stats = computeStats(orders, lines);
  const productImages: Record<number, string> = {};
  for (const p of products) {
    if (p.imageUrl) productImages[p.id] = p.imageUrl;
  }

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
          value={formatPrice(stats.last7Days[stats.last7Days.length - 1].revenueCents)}
          accent="#22c55e"
        />
        <KpiCard label="طلبات نشطة" value={String(stats.activeOrders)} accent="#3b82f6" />
        <KpiCard label="غير مدفوعة" value={String(stats.unpaidOrders)} accent="#f59e0b" />
        <KpiCard label="متوسط قيمة الطلب" value={formatPrice(stats.avgOrderCents)} accent="#a78bfa" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-lg font-extrabold">الطلبات — آخر 7 أيام</h2>
          <TrendChart data={stats.last7Days} color="#3b82f6" />
        </section>
        <section className="rounded-3xl border border-line bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-lg font-extrabold">الإيراد — آخر 7 أيام</h2>
          <RevenueChart data={stats.last7Days} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-lg font-extrabold">توزيع الطلبات حسب الحالة</h2>
          <DonutChart data={stats.byStatus} />
        </section>
        <section className="rounded-3xl border border-line bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-lg font-extrabold">الأطباق الأكثر طلباً</h2>
          <TopProductsChart data={stats.topProducts} images={productImages} />
        </section>
      </div>

      <div className="mt-6 rounded-3xl border border-line bg-card p-5 shadow-soft">
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
