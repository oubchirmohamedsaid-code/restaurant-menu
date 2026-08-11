import { useState } from "react";
import type { FormEvent } from "react";
import { LogIn, UserPlus, Lock, UserRound } from "lucide-react";
import type { OgtUser, Role } from "@shared/types";
import { ROLE_LABELS } from "@lib/roles";
import { Button, Modal, SelectField, TextField } from "../components/ui";
import { TitleBar } from "../components/TitleBar";

function AddUserDialog({ onClose, onDone }: { onClose: () => void; onDone: (u: OgtUser) => void }) {
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await window.ogt.users.create({
        ownerUsername,
        ownerPassword,
        fullName,
        username,
        password,
        role,
      });
      onDone(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="إضافة مستخدم جديد" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-bold text-amber-800">
            يتطلب تحقق المالك (OWNER) قبل إنشاء أي مستخدم.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="اسم المستخدم للمالك"
            value={ownerUsername}
            onChange={(e) => setOwnerUsername(e.target.value)}
            autoComplete="username"
          />
          <TextField
            label="كلمة مرور المالك"
            type="password"
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="border-t border-line pt-4">
          <p className="mb-3 text-sm font-black text-foreground">بيانات المستخدم الجديد</p>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="الاسم الكامل"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <TextField
              label="اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <TextField
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="8 أحرف على الأقل"
            />
            <SelectField
              label="الدور"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={loading}>
            إنشاء المستخدم
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function LoginScreen({
  onLogin,
}: {
  onLogin: (u: OgtUser) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await window.ogt.auth.login({ username, password });
      onLogin(user);
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
          <h1 className="text-center text-xl font-black text-foreground">تسجيل الدخول إلى OGTX</h1>
          <p className="mt-1 text-center text-sm font-semibold text-muted">
            أدخل بياناتك للوصول إلى لوحة الإدارة
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-foreground">اسم المستخدم</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="h-11 w-full rounded-xl border border-line bg-surface ps-10 text-sm font-semibold outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-foreground">كلمة المرور</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 w-full rounded-xl border border-line bg-surface ps-10 text-sm font-semibold outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </label>
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              <LogIn className="size-4" />
              دخول
            </Button>
          </form>

          <div className="mt-4 border-t border-line pt-4 text-center">
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-accent transition-colors hover:text-accent-strong"
            >
              <UserPlus className="size-4" />
              + إضافة مستخدم
            </button>
          </div>
        </div>
      </div>
      {showAdd && <AddUserDialog onClose={() => setShowAdd(false)} onDone={(u) => onLogin(u)} />}
    </div>
  );
}
