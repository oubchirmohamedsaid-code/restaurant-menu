import { useState } from "react";
import type { OgtStockItemInput, OgtStockItemWithStatus } from "@shared/types";
import { STOCK_ITEM_TYPES, STOCK_TYPE_LABELS, STOCK_UNITS } from "@lib/stock";
import { Button, Modal, SelectField, TextField } from "../../components/ui";
import { centsToDinarInput, parseDinarToCents } from "../cashbox/cashbox-utils";

export function ItemModal({
  item,
  busy,
  onClose,
  onConfirm,
}: {
  item: OgtStockItemWithStatus | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: OgtStockItemInput) => void;
}) {
  const editing = item != null;
  const [name, setName] = useState(editing ? item.name : "");
  const [type, setType] = useState(editing ? item.type : "raw");
  const [unit, setUnit] = useState(editing ? item.unit : "piece");
  const [minQty, setMinQty] = useState(editing ? String(item.minQuantity) : "");
  const [cost, setCost] = useState(editing ? centsToDinarInput(item.unitCostCents) : "");
  const [supplier, setSupplier] = useState(editing ? item.supplier : "");
  const [note, setNote] = useState(editing ? item.note : "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const n = name.trim();
    if (!n) {
      setError("اسم الصنف مطلوب");
      return;
    }
    const min = minQty.trim() === "" ? 0 : Number(minQty.replace(",", "."));
    if (minQty.trim() !== "" && (!Number.isFinite(min) || min < 0)) {
      setError("الحد الأدنى يجب أن يكون رقماً موجباً");
      return;
    }
    const costCents = cost.trim() === "" ? 0 : parseDinarToCents(cost);
    if (cost.trim() !== "" && costCents == null) {
      setError("سعر الوحدة غير صالح (مثال: 150.50)");
      return;
    }
    setError(null);
    onConfirm({ name: n, type, unit, minQuantity: min, unitCostCents: costCents ?? 0, supplier: supplier.trim(), note: note.trim() });
  }

  return (
    <Modal title={editing ? `تعديل الصنف: ${item.name}` : "إضافة صنف جديد"} onClose={onClose}>
      <div className="space-y-4">
        <TextField
          label="اسم الصنف *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: دجاج، طماطم، علب تغليف"
        />

        <div>
          <span className="mb-1.5 block text-sm font-bold text-foreground">النوع</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {STOCK_ITEM_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`h-10 rounded-xl border text-xs font-bold transition-colors ${
                  type === t
                    ? "border-accent bg-accent/10 text-accent-strong"
                    : "border-line bg-card-2/60 text-muted hover:bg-card-2 hover:text-foreground"
                }`}
              >
                {STOCK_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <SelectField label="وحدة القياس" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {STOCK_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="الحد الأدنى للتنبيه"
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
            placeholder="0"
            inputMode="decimal"
          />
          <TextField
            label="سعر الوحدة (دج)"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
          />
        </div>

        <TextField
          label="المورد"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="اسم المورد (اختياري)"
        />

        <TextField
          label="ملاحظة"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ملاحظات (اختياري)"
        />

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit} loading={busy}>
            {editing ? "حفظ التعديلات" : "إضافة الصنف"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
