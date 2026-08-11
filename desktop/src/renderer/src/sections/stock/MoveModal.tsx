import { useState } from "react";
import type { OgtStockItemWithStatus, OgtStockMovementInput } from "@shared/types";
import { STOCK_KIND_LABELS } from "@lib/stock";
import type { OgtStockMovementKind } from "@shared/types";
import { Button, Modal, TextField } from "../../components/ui";

type ManualKind = Exclude<OgtStockMovementKind, "sale" | "restore">;
export type { ManualKind };

export function MoveModal({
  item,
  kind,
  busy,
  onClose,
  onConfirm,
}: {
  item: OgtStockItemWithStatus;
  kind: ManualKind;
  busy: boolean;
  onClose: () => void;
  onConfirm: (draft: OgtStockMovementInput) => void;
}) {
  const [qty, setQty] = useState("");
  const [newQty, setNewQty] = useState(kind === "count" ? String(item.quantity) : "");
  const [reason, setReason] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsReason = kind === "out" || kind === "adjust" || kind === "count";

  function submit() {
    if (kind === "in" || kind === "out") {
      const q = Number(qty.replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) {
        setError("أدخل كمية صحيحة أكبر من صفر");
        return;
      }
      if (kind === "out" && q > item.quantity + 1e-9) {
        setError(`الكمية المتاحة ${item.quantity} ${item.unit} فقط`);
        return;
      }
      if (needsReason && !reason.trim()) {
        setError("السبب إجباري لهذه الحركة");
        return;
      }
      setError(null);
      onConfirm({ kind, itemId: item.id, quantity: q, reason: reason.trim(), supplier: supplier.trim(), invoice: invoice.trim(), note: note.trim() });
      return;
    }
    const q = Number(newQty.replace(",", "."));
    if (!Number.isFinite(q) || q < 0) {
      setError("أدخل كمية صحيحة أكبر من أو تساوي صفر");
      return;
    }
    if (!reason.trim()) {
      setError("السبب إجباري لهذه الحركة");
      return;
    }
    setError(null);
    if (kind === "count") {
      onConfirm({ kind, itemId: item.id, actualQuantity: q, reason: reason.trim(), note: note.trim() });
    } else {
      onConfirm({ kind, itemId: item.id, newQuantity: q, reason: reason.trim(), note: note.trim() });
    }
  }

  const title = `${STOCK_KIND_LABELS[kind]}: ${item.name}`;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-card-2/60 px-4 py-3 text-sm font-bold text-foreground">
          الكمية الحالية: <span className="tabular-nums">{item.quantity}</span> {item.unit}
          {kind === "out" && <span className="text-muted"> · المتاح للخروج: <span className="tabular-nums">{item.quantity}</span></span>}
          {kind === "count" && <span className="text-muted"> · أدخل الكمية الفعلية ويُحسب الفرق تلقائياً</span>}
          {kind === "adjust" && <span className="text-muted"> · الكمية الجديدة بعد التعديل</span>}
        </div>

        {(kind === "in" || kind === "out") && (
          <TextField
            label={kind === "in" ? "كمية الإدخال *" : "كمية الإخراج *"}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={`مثال: ${item.quantity || 10}`}
            inputMode="decimal"
          />
        )}

        {(kind === "adjust" || kind === "count") && (
          <TextField
            label="الكمية الجديدة *"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            inputMode="decimal"
          />
        )}

        {needsReason && (
          <TextField
            label="السبب *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={kind === "count" ? "مثال: جرد شهري" : "مثال: تالف، استهلاك إضافي"}
          />
        )}

        {kind === "in" && (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="المورد"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="اسم المورد (اختياري)"
            />
            <TextField
              label="رقم الفاتورة"
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              placeholder="اختياري"
            />
          </div>
        )}

        <TextField
          label="ملاحظة"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="تفاصيل إضافية (اختياري)"
        />

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit} loading={busy}>
            تأكيد الحركة
          </Button>
        </div>
      </div>
    </Modal>
  );
}
