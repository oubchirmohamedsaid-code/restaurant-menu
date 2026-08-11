import { useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import type { OgtAddonGroup, OgtFlag } from "@shared/types";
import { Modal } from "../../components/ui";
import { parsePriceInput, priceInput } from "./menu-utils";

function OptionRow({
  groupId,
  option,
  busy,
  onSave,
  onDelete,
}: {
  groupId: number;
  option: { id?: number; name: string; priceCents: number };
  busy: boolean;
  onSave: (input: { id?: number; groupId: number; name: string; priceCents: number }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState(option.name);
  const [price, setPrice] = useState(priceInput(option.priceCents));
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    const priceCents = parsePriceInput(price);
    if (!trimmed || priceCents == null) return;
    setSaving(true);
    try {
      await onSave({ id: option.id, groupId, name: trimmed, priceCents });
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex items-center gap-1.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="اسم الخيار"
        className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs font-semibold outline-none focus:border-accent"
      />
      <input
        type="number"
        min="0"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        title="السعر بالدج"
        className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-xs font-semibold outline-none focus:border-accent"
      />
      <button
        onClick={() => void save()}
        disabled={busy || saving}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
        title="حفظ"
      >
        <Check className="size-3.5" />
      </button>
      {option.id != null && (
        <button
          onClick={() => void onDelete(option.id as number)}
          disabled={busy}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="حذف"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}

function GroupCard({
  group,
  busy,
  onRename,
  onToggleActive,
  onDelete,
  onSaveOption,
  onDeleteOption,
}: {
  group: OgtAddonGroup;
  busy: boolean;
  onRename: (id: number, name: string) => Promise<void>;
  onToggleActive: (id: number, isActive: OgtFlag) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onSaveOption: (input: { id?: number; groupId: number; name: string; priceCents: number }) => Promise<void>;
  onDeleteOption: (id: number) => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(group.name);
  const [open, setOpen] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("0.00");

  async function saveRename() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await onRename(group.id, trimmed);
    setRenaming(false);
  }

  async function addOption() {
    const trimmed = newName.trim();
    const priceCents = parsePriceInput(newPrice);
    if (!trimmed || priceCents == null) return;
    await onSaveOption({ groupId: group.id, name: trimmed, priceCents });
    setNewName("");
    setNewPrice("0.00");
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <div className="flex items-center gap-2 border-b border-line bg-card-2/40 px-3 py-2.5">
        {renaming ? (
          <>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              className="h-8 min-w-0 flex-1 rounded-lg border border-accent bg-surface px-2 text-sm font-bold outline-none"
            />
            <button
              onClick={() => void saveRename()}
              disabled={busy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-strong disabled:opacity-50"
              title="حفظ الاسم"
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => setRenaming(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-card-2"
              title="إلغاء"
            >
              <X className="size-3.5" />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-sm font-black text-foreground">
              <ChevronDown className={`size-4 text-muted transition-transform ${open ? "" : "-rotate-90"}`} />
              {group.name}
            </button>
            <span className="text-[10px] font-semibold text-muted">
              {group.options.length} خيار · {group.productCount} طبق
            </span>
            <span className="ms-auto flex items-center gap-1">
              <button
                onClick={() => void onToggleActive(group.id, group.isActive === 1 ? 0 : 1)}
                title={group.isActive === 1 ? "إخفاء المجموعة" : "إظهار المجموعة"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card-2 hover:text-foreground"
              >
                {group.isActive === 1 ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5 text-accent" />}
              </button>
              <button
                onClick={() => {
                  setDraft(group.name);
                  setRenaming(true);
                }}
                title="تعديل الاسم"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card-2 hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={() => void onDelete(group.id)}
                title="حذف المجموعة"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          </>
        )}
      </div>

      {open && (
        <div className="space-y-2 p-3">
          <ul className="space-y-1.5">
            {group.options.map((o) => (
              <OptionRow key={o.id} groupId={group.id} option={o} busy={busy} onSave={onSaveOption} onDelete={onDeleteOption} />
            ))}
            {group.options.length === 0 && (
              <li className="py-1 text-center text-[11px] font-semibold text-muted">لا توجد خيارات بعد.</li>
            )}
          </ul>
          <div className="flex items-center gap-1.5 border-t border-line/60 pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="خيار جديد"
              className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs font-semibold outline-none focus:border-accent"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              title="السعر بالدج"
              className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-xs font-semibold outline-none focus:border-accent"
            />
            <button
              onClick={() => void addOption()}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[11px] font-bold text-accent-strong transition-colors hover:bg-card-2 disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              إضافة
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function AddonGroupsModal({
  groups,
  busy,
  onClose,
  onChanged,
}: {
  groups: OgtAddonGroup[];
  busy: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [newGroup, setNewGroup] = useState("");
  const [creating, setCreating] = useState(false);

  async function run(op: () => Promise<unknown>) {
    try {
      await op();
      await onChanged();
    } catch (err) {
      // errors surface through the parent toast via onChanged? no — rethrow to caller
      throw err;
    }
  }

  async function createGroup() {
    const trimmed = newGroup.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await run(() => window.ogt.menu.createAddonGroup({ name: trimmed }));
      setNewGroup("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="مجموعات الإضافات" onClose={onClose} wide>
      <div className="max-h-[70vh] space-y-3 overflow-auto">
        <p className="text-xs font-semibold text-muted">
          تُربط المجموعات بالأطباق لتظهر للزبون عند الطلب (مثال: الحجم، الإضافات، أنواع الخبز).
        </p>

        <div className="flex items-center gap-2 rounded-2xl border border-line bg-card-2/40 p-2">
          <input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="اسم المجموعة الجديدة…"
            className="h-9 min-w-0 flex-1 rounded-xl border border-transparent bg-surface px-3 text-sm font-semibold outline-none focus:border-accent"
            onKeyDown={(e) => {
              if (e.key === "Enter") void createGroup();
            }}
          />
          <button
            onClick={() => void createGroup()}
            disabled={busy || creating}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            <Plus className="size-4" />
            إنشاء
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm font-bold text-muted">لا توجد مجموعات بعد.</p>
        ) : (
          <ul className="space-y-2">
            {groups.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                busy={busy}
                onRename={(id, name) => run(() => window.ogt.menu.updateAddonGroup({ id, name, isActive: g.isActive }))}
                onToggleActive={(id, isActive) => run(() => window.ogt.menu.updateAddonGroup({ id, name: g.name, isActive }))}
                onDelete={(id) => {
                  if (window.confirm(`حذف مجموعة «${g.name}» وجميع خياراتها؟`)) {
                    return run(() => window.ogt.menu.deleteAddonGroup({ id }));
                  }
                  return Promise.resolve();
                }}
                onSaveOption={(input) => run(() => window.ogt.menu.saveAddonOption(input))}
                onDeleteOption={(id) => run(() => window.ogt.menu.deleteAddonOption({ id }))}
              />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
