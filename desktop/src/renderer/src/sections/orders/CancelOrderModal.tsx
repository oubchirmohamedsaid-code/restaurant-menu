import { useState } from "react";
import { XCircle } from "lucide-react";
import type { OgtOrder } from "@shared/types";
import { CANCEL_REASONS } from "@lib/orders";
import { formatMoney } from "../../format";
import { Modal } from "../../components/ui";

export function CancelOrderModal({
  order,
  busy,
  onClose,
  onConfirm,
}: {
  order: OgtOrder;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [custom, setCustom] = useState("");

  const finalReason = reason === "other" ? custom.trim() : reason;

  return (
    <Modal title={`إلغاء الطلب #${order.id}`} onClose={onClose}>
      <p className="mb-4 text-sm font-bold text-foreground">
        {order.customerName || "زبون بدون اسم"} · {formatMoney(order.totalCents)} دج
      </p>
      <p className="mb-2 text-xs font-black text-muted">اختر سبب الإلغاء</p>
      <div className="space-y-1.5">
        {CANCEL_REASONS.map((r) => (
          <label
            key={r}
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
              reason === r
                ? "border-accent bg-accent/10 text-foreground"
                : "border-line bg-surface text-muted hover:bg-card-2"
            }`}
          >
            <input
              type="radio"
              name="cancel-reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="accent-accent"
            />
            {r}
          </label>
        ))}
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
            reason === "other"
              ? "border-accent bg-accent/10 text-foreground"
              : "border-line bg-surface text-muted hover:bg-card-2"
          }`}
        >
          <input
            type="radio"
            name="cancel-reason"
            value="other"
            checked={reason === "other"}
            onChange={() => setReason("other")}
            className="accent-accent"
          />
          سبب آخر
        </label>
      </div>
      {reason === "other" && (
        <textarea
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          rows={2}
          placeholder="اكتب سبب الإلغاء..."
          className="mt-3 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      )}
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => onConfirm(finalReason)}
          disabled={busy || (reason === "other" && !custom.trim())}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          <XCircle className="size-4" />
          تأكيد الإلغاء
        </button>
        <button
          onClick={onClose}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground"
        >
          تراجع
        </button>
      </div>
    </Modal>
  );
}
