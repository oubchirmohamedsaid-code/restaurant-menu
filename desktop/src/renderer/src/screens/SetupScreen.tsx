import { useState } from "react";
import type { FormEvent } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import type { OgtUser } from "@shared/types";
import { Button, TextField } from "../components/ui";
import { TitleBar } from "../components/TitleBar";

export function SetupScreen({ onDone }: { onDone: (u: OgtUser) => void }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    try {
      const user = await window.ogt.auth.setup({ fullName, username, password });
      onDone(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <div
        className="flex flex-1 items-center justify-center p-6"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(245,158,11,0.12), transparent 70%)",
        }}
      >
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-card">
          <div className="mb-6 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-2xl font-black text-white">
              O
            </span>
          </div>
          <h1 className="text-center text-xl font-black text-foreground">الإعداد الأولي</h1>
          <p className="mt-1 text-center text-sm font-semibold text-muted">
            أنشئ حساب المالك (OWNER) — صاحب أعلى صلاحية في النظام
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <TextField
              label="الاسم الكامل"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: أحمد محمد"
            />
            <TextField
              label="اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3-32 حرفاً"
              autoComplete="username"
            />
            <TextField
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 أحرف على الأقل"
              autoComplete="new-password"
            />
            <TextField
              label="تأكيد كلمة المرور"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              <ShieldCheck className="size-4" />
              إنشاء حساب المالك
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-bold text-muted">
            <UserRound className="size-3.5" />
            سيتم تخزين كلمة المرور مشفرة فقط
          </div>
        </div>
      </div>
    </div>
  );
}
