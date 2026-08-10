"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveSettingsAction } from "@/app/admin/actions";
import type { ActionResult } from "@/app/admin/actions";

const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "late_new_minutes", label: "عتبة «طلب جديد»", hint: "بعد كم دقيقة في مرحلة الطلب الجديد يظهر تنبيه التأخر؟" },
  { key: "late_preparing_minutes", label: "عتبة «قيد التحضير»", hint: "بعد كم دقيقة في مرحلة التحضير يظهر تنبيه التأخر؟" },
  { key: "late_delivered_minutes", label: "عتبة «تم التوصيل»", hint: "بعد كم دقيقة من التوصيل قبل اكتمال الطلب؟" },
];

export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveSettingsAction, {});

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.key} className="mb-1 block text-sm font-extrabold text-foreground">
            {f.label}
          </label>
          <p className="mb-2 text-xs text-muted">{f.hint}</p>
          <div className="flex items-center gap-2">
            <input
              id={f.key}
              name={f.key}
              type="number"
              min={1}
              max={720}
              required
              defaultValue={initial[f.key]}
              className="w-32 rounded-xl border border-line bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
            />
            <span className="text-sm font-bold text-muted">دقيقة</span>
          </div>
        </div>
      ))}
      {state.error && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-400">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-xl bg-green-500/10 px-3 py-2 text-sm font-bold text-green-400">تم حفظ الإعدادات ✓</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-5 py-2 text-sm font-extrabold text-black transition-transform hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
      </button>
    </form>
  );
}
