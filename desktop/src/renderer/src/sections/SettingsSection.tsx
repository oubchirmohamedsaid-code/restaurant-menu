import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Settings, UsersRound, UserPlus, Trash2, ShieldCheck } from "lucide-react";
import type { OgtUser, Role } from "@shared/types";
import { ROLE_LABELS } from "@lib/roles";
import { permissionsFor } from "@lib/perms";
import { Button, Modal, SelectField, TextField } from "../components/ui";
import { PlaceholderScreen } from "../components/PlaceholderScreen";

function AddUserForm({ onDone }: { onDone: (u: OgtUser) => void }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await window.ogt.users.create({
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
    <form onSubmit={submit} className="space-y-3">
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
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="كلمة المرور"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
      <TextField
        label="كلمة مرور المالك (للتحقق)"
        type="password"
        value={ownerPassword}
        onChange={(e) => setOwnerPassword(e.target.value)}
      />
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" loading={loading}>
          <UserPlus className="size-4" />
          إنشاء المستخدم
        </Button>
      </div>
    </form>
  );
}

function UsersPanel({ user }: { user: OgtUser }) {
  const [users, setUsers] = useState<OgtUser[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await window.ogt.users.list());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل المستخدمين");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(id: number, role: Role, password: string) {
    try {
      await window.ogt.users.updateRole({ id, role, password });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تعديل الدور");
    }
  }

  async function remove(id: number, name: string) {
    const ok = window.confirm(`هل تريد حذف المستخدم "${name}"؟`);
    if (!ok) return;
    const password = window.prompt("أدخل كلمة مرور المالك للتحقق:");
    if (!password) return;
    try {
      await window.ogt.users.remove({ id, password });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حذف المستخدم");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
          <UsersRound className="size-5 text-accent" />
          إدارة المستخدمين
        </h2>
        <Button onClick={() => setShowAdd(true)} className="h-9 px-3 text-xs">
          <UserPlus className="size-4" />
          إضافة مستخدم
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-card-2 text-right text-xs font-black text-muted">
              <th className="px-4 py-3">المستخدم</th>
              <th className="px-4 py-3">الدور</th>
              <th className="px-4 py-3">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className="font-bold text-foreground">{u.fullName}</p>
                  <p className="text-xs font-semibold text-muted">@{u.username}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={`size-4 ${u.role === "OWNER" ? "text-accent" : "text-muted"}`}
                    />
                    <select
                      value={u.role}
                      disabled={u.id === user.id}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        const password = window.prompt("أدخل كلمة مرور المالك للتحقق:");
                        if (password) void changeRole(u.id, role, password);
                        else void load();
                      }}
                      className="h-9 rounded-lg border border-line bg-surface px-2 text-sm font-bold text-foreground outline-none focus:border-accent disabled:opacity-50"
                    >
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => void remove(u.id, u.fullName)}
                    disabled={u.id === user.id}
                    className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="إضافة مستخدم جديد" onClose={() => setShowAdd(false)}>
          <AddUserForm
            onDone={(u) => {
              setShowAdd(false);
              void load();
              void u;
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export function SettingsSection({ user }: { user: OgtUser }) {
  const isOwner = permissionsFor(user.role).canManageUsers;
  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="flex items-center gap-2 text-xl font-black text-foreground">
        <Settings className="size-6 text-accent" />
        الإعدادات
      </h1>
      {isOwner ? (
        <UsersPanel user={user} />
      ) : (
        <PlaceholderScreen
          icon={Settings}
          title="الإعدادات"
          description="إدارة المستخدمين متاحة للمالك فقط. باقي إعدادات النظام ستُضاف لاحقاً."
        />
      )}
    </div>
  );
}
