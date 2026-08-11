import { useMemo, useState } from "react";
import { Lock, Unlock, Wallet, Receipt, AlertTriangle } from "lucide-react";
import type { OgtCashboxSession, OgtCashboxSessionDetail } from "@shared/types";
import { DIFF_REASONS } from "@lib/cashbox";
import { Button, Modal, TextField } from "../../components/ui";
import { formatMoney } from "../../format";
import { formatDateTime } from "../orders/orders-utils";
import { centsToDinarInput, parseDinarToCents } from "./cashbox-utils";

export function OpenSessionModal({
  suggestedCents,
  busy,
  onClose,
  onConfirm,
}: {
  suggestedCents: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (openingBalanceCents: number, note: string) => void;
}) {
  const [amount, setAmount] = useState(centsToDinarInput(suggestedCents));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const cents = parseDinarToCents(amount);
    if (cents == null || cents < 0) {
      setError("أدخل رصيداً صحيحاً غير سالب");
      return;
    }
    setError(null);
    onConfirm(cents, note.trim());
  }

  return (
    <Modal title="فتح الصندوق" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-card-2/60 p-3 text-xs font-semibold text-muted">
          <p className="flex items-center gap-1.5">
            <Wallet className="size-4 text-accent" />
            الرصيد الحالي المقترح للافتتاح: <span className="font-black text-foreground">{formatMoney(suggestedCents)} دج</span>
          </p>
          <p className="mt-1">يمكنك تعديل الرصيد الافتتاحي عند بداية اليوم/الوردية.</p>
        </div>
        <TextField
          label="رصيد البداية (دج)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          error={error ?? undefined}
          autoFocus
        />
        <TextField
          label="ملاحظة (اختياري)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثال: بداية نوبة الصباح"
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={busy} onClick={submit}>
            فتح الصندوق
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function CloseSessionModal({
  session,
  expectedCents,
  busy,
  onClose,
  onConfirm,
}: {
  session: OgtCashboxSession;
  expectedCents: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (actualCents: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState(centsToDinarInput(expectedCents));
  const [reason, setReason] = useState(DIFF_REASONS[0]);
  const [reasonDetail, setReasonDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const actualCents = parseDinarToCents(amount);
  const diff = actualCents == null ? null : actualCents - expectedCents;
  const hasDiff = diff != null && diff !== 0;

  const confirmDisabled = useMemo(
    () => busy || actualCents == null || actualCents < 0 || (hasDiff && !reason),
    [busy, actualCents, hasDiff, reason],
  );

  function submit() {
    if (actualCents == null || actualCents < 0) {
      setError("أدخل رصيداً فعلياً صحيحاً غير سالب");
      return;
    }
    if (hasDiff && !reason) {
      setError("سبب الفرق مطلوب");
      return;
    }
    setError(null);
    const fullReason = hasDiff ? `${reason}${reasonDetail.trim() ? ` — ${reasonDetail.trim()}` : ""}` : "";
    onConfirm(actualCents, fullReason);
  }

  return (
    <Modal title="إغلاق الصندوق" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-card-2/60 p-3 text-sm">
          <p className="flex justify-between">
            <span className="font-semibold text-muted">رصيد البداية</span>
            <span className="font-black tabular-nums">{formatMoney(session.openingBalanceCents)} دج</span>
          </p>
          <p className="mt-1 flex justify-between">
            <span className="font-semibold text-muted">المتوقع (افتتاحي + حركة نقدية)</span>
            <span className="font-black tabular-nums text-accent-strong">{formatMoney(expectedCents)} دج</span>
          </p>
          {diff != null && diff !== 0 && (
            <p className={`mt-1 flex justify-between font-black ${diff > 0 ? "text-green-700" : "text-red-700"}`}>
              <span className="font-semibold">الفرق (فعلي - متوقع)</span>
              <span className="tabular-nums">
                {diff > 0 ? "+" : ""}
                {formatMoney(diff)} دج
              </span>
            </p>
          )}
        </div>
        <TextField
          label="الرصيد الفعلي بعد العد (دج)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          error={error ?? undefined}
          autoFocus
        />
        {hasDiff && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-black text-red-700">
              <AlertTriangle className="size-3.5" />
              يوجد فرق ({diff! > 0 ? "+" : ""}
              {formatMoney(diff!)} دج) — سجل سبب الفرق للمتابعة.
            </p>
            <label className="mt-2 block">
              <span className="mb-1.5 block text-xs font-bold text-foreground">سبب الفرق</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-semibold outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {DIFF_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <input
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder="تفاصيل إضافية (اختياري)"
              className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-semibold outline-none transition-colors focus:border-accent"
            />
          </div>
        )}
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          تأكد من تطابق المبلغ الفعلي قبل تأكيد الإغلاق — لن يمكن فتحه مرة أخرى بعد ذلك.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            تراجع
          </Button>
          <Button loading={busy} disabled={confirmDisabled} onClick={submit}>
            تأكيد الإغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function OpeningEditModal({
  session,
  busy,
  onClose,
  onConfirm,
}: {
  session: OgtCashboxSession;
  busy: boolean;
  onClose: () => void;
  onConfirm: (openingBalanceCents: number) => void;
}) {
  const [amount, setAmount] = useState(centsToDinarInput(session.openingBalanceCents));
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const cents = parseDinarToCents(amount);
    if (cents == null || cents < 0) {
      setError("أدخل رصيداً صحيحاً غير سالب");
      return;
    }
    setError(null);
    onConfirm(cents);
  }

  return (
    <Modal title="تعديل الرصيد الافتتاحي" onClose={onClose}>
      <div className="space-y-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Lock className="size-3.5 text-muted" />
          بعد بدء الحركة يكون التعديل متاحاً للمالك فقط.
        </p>
        <TextField
          label="الرصيد الافتتاحي (دج)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          error={error ?? undefined}
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button loading={busy} onClick={submit}>
            <Unlock className="size-4" />
            حفظ
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <p className="flex items-center justify-between text-sm">
      <span className="font-semibold text-muted">{label}</span>
      <span
        className={`font-black tabular-nums ${tone === "pos" ? "text-green-700" : tone === "neg" ? "text-red-700" : "text-foreground"}`}
      >
        {value}
      </span>
    </p>
  );
}

export function SessionReportModal({
  detail,
  onClose,
  onOpenOrder,
}: {
  detail: OgtCashboxSessionDetail;
  onClose: () => void;
  onOpenOrder?: (orderId: number) => void;
}) {
  const { session, breakdown, rows } = detail;
  const active = rows.filter((r) => r.status === "active" && r.correctsTxId == null);
  const hasDiff = session.diffCents !== 0;

  return (
    <Modal title="تقرير إغلاق اليوم" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-muted">
          <span>
            التاريخ:{" "}
            <span className="text-foreground">{new Date(session.openedAt).toLocaleDateString("ar-DZ", { day: "2-digit", month: "long", year: "numeric" })}</span>
          </span>
          <span>
            الفتح: <span className="text-foreground">{formatDateTime(session.openedAt)}</span> بواسطة{" "}
            <span className="text-foreground">{session.openedByName || "system"}</span>
          </span>
          <span>
            الإغلاق: <span className="text-foreground">{formatDateTime(session.closedAt ?? session.openedAt)}</span> بواسطة{" "}
            <span className="text-foreground">{session.closedByName || "system"}</span>
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-card-2/40 p-3 space-y-1.5">
            <Row label="رصيد البداية" value={`${formatMoney(session.openingBalanceCents)} دج`} />
            <Row label="إجمالي المبيعات" value={`+ ${formatMoney(breakdown.salesCents)} دج`} tone="pos" />
            <Row label="مداخيل يدوية" value={`+ ${formatMoney(breakdown.manualIncomeCents)} دج`} tone="pos" />
            <Row label="إيداعات" value={`+ ${formatMoney(breakdown.depositCents)} دج`} tone="pos" />
          </div>
          <div className="rounded-xl border border-line bg-card-2/40 p-3 space-y-1.5">
            <Row label="المصاريف" value={`- ${formatMoney(breakdown.expenseCents)} دج`} tone="neg" />
            <Row label="سحوبات" value={`- ${formatMoney(breakdown.withdrawalCents)} دج`} tone="neg" />
            <Row label="تصحيحات (داخل / خارج)" value={`${formatMoney(breakdown.adjustmentInCents)} / ${formatMoney(breakdown.adjustmentOutCents)} دج`} />
            <Row label="عدد العمليات" value={`${active.length}`} />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 space-y-1.5">
          <Row label="الرصيد المتوقع" value={`${formatMoney(session.expectedCents)} دج`} />
          <Row label="الرصيد الفعلي" value={`${formatMoney(session.actualCents)} دج`} />
          <Row
            label="الفرق"
            value={`${session.diffCents > 0 ? "+" : ""}${formatMoney(session.diffCents)} دج`}
            tone={hasDiff ? (session.diffCents > 0 ? "pos" : "neg") : undefined}
          />
        </div>

        {session.note && (
          <p className="rounded-xl border border-line bg-card-2/40 px-3 py-2 text-xs font-semibold text-muted">
            ملاحظة الفتح: {session.note}
          </p>
        )}
        {session.closeReason && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">
            سبب الفرق: {session.closeReason}
          </p>
        )}

        {rows.length > 0 && (
          <div className="max-h-52 overflow-auto rounded-xl border border-line">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-line bg-card-2/40 text-[11px] font-black text-muted">
                  <th className="px-3 py-2 text-start">الوقت</th>
                  <th className="px-3 py-2 text-start">النوع</th>
                  <th className="px-3 py-2 text-start">المبلغ</th>
                  <th className="px-3 py-2 text-start">الطريقة</th>
                  <th className="px-3 py-2 text-start">المستخدم</th>
                  <th className="px-3 py-2 text-start">ملاحظة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-muted">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="px-3 py-1.5 font-bold text-foreground">
                      {r.source === "order" && r.orderId != null ? (
                        <button
                          onClick={() => onOpenOrder?.(r.orderId as number)}
                          className="inline-flex items-center gap-1 font-black text-accent-strong hover:underline"
                        >
                          <Receipt className="size-3" />
                          طلب #{r.orderId}
                        </button>
                      ) : (
                        (r.type === "income" ? "بيع/دخل" : r.type === "expense" ? "مصروف" : r.type === "deposit" ? "إيداع" : r.type === "withdrawal" ? "سحب" : "تصحيح")
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-1.5 font-black tabular-nums ${r.direction === "in" ? "text-green-700" : "text-red-700"}`}>
                      {r.direction === "in" ? "+" : "-"} {formatMoney(r.amountCents)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-muted">{r.paymentMethod}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-muted">{r.userName || "system"}</td>
                    <td className="max-w-52 truncate px-3 py-1.5 font-semibold text-muted">{r.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
}
