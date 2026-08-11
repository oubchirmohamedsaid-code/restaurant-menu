import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { OgtCashboxTx } from "@shared/types";
import { CASHBOX_METHOD_LABELS, CASHBOX_TX_LABELS } from "@lib/cashbox";
import { Button, Modal, TextField } from "../../components/ui";
import { formatMoney } from "../../format";

export function CorrectTxModal({
  tx,
  busy,
  onClose,
  onConfirm,
}: {
  tx: OgtCashboxTx;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!reason.trim()) {
      setError("سبب التصحيح مطلوب");
      return;
    }
    setError(null);
    onConfirm(reason.trim());
  }

  return (
    <Modal title="تصحيح عملية" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-card-2/60 p-3 text-sm">
          <p className="flex justify-between">
            <span className="font-semibold text-muted">العملية #{tx.txNumber}</span>
            <span className="font-black">{CASHBOX_TX_LABELS[tx.type]}</span>
          </p>
          <p className="mt-1 flex justify-between">
            <span className="font-semibold text-muted">المبلغ</span>
            <span className={`font-black tabular-nums ${tx.direction === "in" ? "text-green-700" : "text-red-700"}`}>
              {tx.direction === "in" ? "+" : "-"} {formatMoney(tx.amountCents)} دج
            </span>
          </p>
          <p className="mt-1 flex justify-between text-xs font-semibold text-muted">
            <span>الطريقة</span>
            <span>{CASHBOX_METHOD_LABELS[tx.paymentMethod] ?? tx.paymentMethod}</span>
          </p>
          {tx.note && <p className="mt-1 text-xs font-semibold text-muted">ملاحظة: {tx.note}</p>}
        </div>
        <TextField
          label="سبب التصحيح"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="مثال: مبلغ خاطئ، يجب استرجاعه"
          error={error ?? undefined}
          autoFocus
        />
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          سيتم إنشاء عملية تصحيح معاكسة مسجلة في السجل مع سبب التصحيح ومستخدمك، دون حذف العملية الأصلية.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="danger" loading={busy} onClick={submit}>
            تصحيح العملية
          </Button>
        </div>
      </div>
    </Modal>
  );
}
