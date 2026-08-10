import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";
import { getSetting } from "@/lib/db";
import { DEFAULT_LATE_MINUTES } from "@/lib/orders";
import { isAdmin } from "../actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await isAdmin())) redirect("/admin");
  const [newMin, preparingMin, deliveredMin] = await Promise.all([
    getSetting("late_new_minutes"),
    getSetting("late_preparing_minutes"),
    getSetting("late_delivered_minutes"),
  ]);
  const initial = {
    late_new_minutes: String(newMin ?? DEFAULT_LATE_MINUTES.new),
    late_preparing_minutes: String(preparingMin ?? DEFAULT_LATE_MINUTES.preparing),
    late_delivered_minutes: String(deliveredMin ?? DEFAULT_LATE_MINUTES.delivered),
  };
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-black">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted">
          عتبات تأخير مراحل الطلب — تُظهرها لوحة الطلبات كعلامة ⚠️ على البطاقات المتأخرة
        </p>
      </header>
      <div className="rounded-3xl border border-line bg-card p-6">
        <SettingsForm initial={initial} />
      </div>
    </div>
  );
}
