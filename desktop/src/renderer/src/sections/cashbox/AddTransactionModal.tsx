import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type {
  OgtCashboxDirection,
  OgtCashboxTxType,
} from "@shared/types";
import {
  CASHBOX_METHODS,
  CASHBOX_METHOD_LABELS,
  CASHBOX_TX_LABELS,
  CASHBOX_TX_TYPES,
  EXPENSE_CATEGORIES,
  defaultDirection,
} from "@lib/cashbox";
import { Button, Modal, SelectField, TextField } from "../../components/ui";
import { parseDinarToCents } from "./cashbox-utils";

export interface AddTxDraft {
  type: OgtCashboxTxType;
  direction: OgtCashboxDirection;
  amountCents: number;
  paymentMethod: string;
  note: string;
  orderId?: number;
}

export function AddTransactionModal({
  busy,
  initialType = "income",
  onClose,
  onConfirm,
}: {
  busy: boolean;
  initialType?: OgtCashboxTxType;
  onClose: () => void;
  onConfirm: (draft: AddTxDraft) => void;
}) {
  const [type, setType] = useState<OgtCashboxTxType>(initialType);
  const [direction, setDirection] = useState<OgtCashboxDirection>(defaultDirection(initialType));
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function changeType(t: OgtCashboxTxType) {
    setType(t);
    setDirection(defaultDirection(t));
  }

  function submit() {
    const cents = parseDinarToCents(amount);
    if (cents == null || cents < 1) {
      setError("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }
    let order: number | undefined;
    if (orderId.trim()) {
      order = Number(orderId.trim());
      if (!Number.isInteger(order) || order < 1) {
        setError("رقم الطلب غير صالح");
        return;
      }
    }
    const userNote = note.trim();
    const finalNote = type === "expense" && category ? `[${category}]${userNote ? ` ${userNote}` : ""}` : userNote;
    setError(null);
    onConfirm({
      type,
      direction,
      amountCents: cents,
      paymentMethod: method,
      note: finalNote,
      orderId: order,
    });
  }

  return (
    <Modal title="إضافة عملية صندوق" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-bold text-foreground">نوع العملية</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CASHBOX_TX_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => changeType(t)}
                className={`h-10 rounded-xl border text-sm font-bold transition-colors ${
                  type === t
                    ? "border-accent bg-accent/10 text-accent-strong"
                    : "border-line bg-card-2/60 text-muted hover:bg-card-2 hover:text-foreground"
                }`}
              >
                {CASHBOX_TX_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {type === "expense" && (
          <SelectField label="نوع المصروف" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
        )}

        {type === "adjustment" && (
          <div>
            <span className="mb-1.5 block text-sm font-bold text-foreground">الاتجاه</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection("in")}
                className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors ${
                  direction === "in"
                    ? "border-green-300 bg-green-50 text-green-700"
                    : "border-line bg-card-2/60 text-muted hover:bg-card-2"
                }`}
              >
                <ArrowDownLeft className="size-4" />
                إضافة
              </button>
              <button
                type="button"
                onClick={() => setDirection("out")}
                className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors ${
                  direction === "out"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-line bg-card-2/60 text-muted hover:bg-card-2"
                }`}
              >
                <ArrowUpRight className="size-4" />
                خصم
              </button>
            </div>
          </div>
        )}

        <TextField
          label="المبلغ (دج)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          error={error ?? undefined}
          autoFocus
        />

        <SelectField label="طريقة الدفع" value={method} onChange={(e) => setMethod(e.target.value)}>
          {CASHBOX_METHODS.map((m) => (
            <option key={m} value={m}>
              {CASHBOX_METHOD_LABELS[m]}
            </option>
          ))}
        </SelectField>

        <TextField
          label="رقم الطلب (اختياري)"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          inputMode="numeric"
          placeholder="مثال: 125"
        />

        <TextField label="ملاحظة" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={busy} onClick={submit}>
            حفظ العملية
          </Button>
        </div>
      </div>
    </Modal>
  );
}
