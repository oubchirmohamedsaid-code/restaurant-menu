import { ArrowLeft, ShieldCheck, KeyRound } from "lucide-react";
import { TitleBar } from "../components/TitleBar";

export function HeroScreen({
  phase,
  onPrimary,
}: {
  phase: "setup" | "login";
  onPrimary: () => void;
}) {
  const primaryLabel = phase === "setup" ? "إعداد المالك" : "تسجيل الدخول";
  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <TitleBar />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(245,158,11,0.16), transparent 70%)",
        }}
      />
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 p-8">
        <div className="flex items-center justify-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-5xl font-black text-white shadow-card">
            O
          </span>
        </div>
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-foreground">
            OGTX
          </h1>
          <p className="mt-3 text-lg font-bold text-muted">لوحة إدارة مطعم OGTX</p>
          <p className="mt-1 text-sm font-semibold text-muted/70">
            نظام إدارة الطلبات والمخزون والمحاسبة — للأدمن فقط
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onPrimary}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-accent px-8 text-base font-black text-white shadow-card transition-all hover:bg-accent-strong"
          >
            {primaryLabel}
            <ArrowLeft className="size-5" />
          </button>
          <div className="mt-3 flex items-center gap-4 text-[11px] font-bold text-muted">
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> حماية بالصلاحيات
            </span>
            <span className="flex items-center gap-1">
              <KeyRound className="size-3.5" /> تشفير كلمات المرور
            </span>
          </div>
        </div>
      </main>
      <p className="relative z-10 pb-4 text-center text-[11px] font-bold text-muted/50">
        الإصدار 0.1.0
      </p>
    </div>
  );
}
