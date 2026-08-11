import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { OgtProductIngredientView, OgtStockItemWithStatus } from "@shared/types";
import { Button, Modal, SelectField, TextField } from "../../components/ui";

interface Row {
  itemId: number | "";
  qty: string;
}

export function RecipeModal({
  product,
  items,
  busy,
  onClose,
  onConfirm,
}: {
  product: OgtProductIngredientView;
  items: OgtStockItemWithStatus[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (rows: { itemId: number; qty: number }[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    product.items.map((i) => ({ itemId: i.itemId, qty: String(i.qty) })),
  );
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setRows((r) => [...r, { itemId: "", qty: "" }]);
  }

  function setRow(index: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((r) => r.filter((_, i) => i !== index));
  }

  function submit() {
    const clean: { itemId: number; qty: number }[] = [];
    const seen = new Set<number>();
    for (const row of rows) {
      if (row.itemId === "") continue;
      const q = Number(row.qty.replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) {
        setError("كمية المكوّن يجب أن تكون أكبر من صفر");
        return;
      }
      if (seen.has(Number(row.itemId))) {
        setError("لا يمكن تكرار نفس المكوّن");
        return;
      }
      seen.add(Number(row.itemId));
      clean.push({ itemId: Number(row.itemId), qty: q });
    }
    setError(null);
    onConfirm(clean);
  }

  return (
    <Modal title={`مكونات: ${product.name}`} onClose={onClose} wide>
      <div className="space-y-3">
        <p className="text-xs font-bold text-muted">
          حدد أصناف الستوك المطلوبة لإنتاج هذا الطبق وكميتها لكل وحدة. عند إكمال الطلب تُخصم الكميات تلقائياً.
        </p>

        <div className="flex items-center gap-2 rounded-xl border border-line bg-card-2/60 px-3 py-2 text-xs font-bold text-muted">
          <span>الصنف</span>
          <span className="ms-auto w-24 text-end">الكمية لكل وحدة</span>
          <span className="w-8" />
        </div>

        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm font-bold text-muted">
            لا توجد مكونات — أضف مكوناً بالزر أدناه
          </div>
        )}

        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <SelectField className="flex-1" value={row.itemId} onChange={(e) => setRow(i, { itemId: e.target.value ? Number(e.target.value) : "" })}>
              <option value="">— اختر صنفاً —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.unit})
                </option>
              ))}
            </SelectField>
            <TextField
              className="w-24"
              value={row.qty}
              onChange={(e) => setRow(i, { qty: e.target.value })}
              placeholder="1"
              inputMode="decimal"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="flex h-11 w-8 items-center justify-center rounded-xl text-muted transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label="حذف"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}

        <Button variant="secondary" onClick={addRow} className="w-full">
          <Plus className="size-4" />
          إضافة مكوّن
        </Button>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit} loading={busy}>
            حفظ المكونات
          </Button>
        </div>
      </div>
    </Modal>
  );
}
