import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Wallet,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Lock,
  Unlock,
  CircleCheck,
  AlertTriangle,
  Receipt,
  X,
} from "lucide-react";
import type {
  OgtCashboxSession,
  OgtCashboxSessionDetail,
  OgtCashboxSummary,
  OgtCashboxTx,
  OgtCashboxTxType,
  OgtLateThresholds,
  OgtOrderDetail,
  OgtUser,
} from "@shared/types";
import {
  CASHBOX_METHOD_LABELS,
  CASHBOX_METHODS,
  CASHBOX_TX_LABELS,
  CASHBOX_TX_TYPES,
  txEffectCents,
} from "@lib/cashbox";
import { DEFAULT_LATE_MINUTES } from "@lib/orders";
import { canManageCashbox, canManageOrders } from "@lib/perms";
import { formatMoney, formatRelative, formatTime } from "../format";
import { OrderDetailPanel } from "./orders/OrderDetailPanel";
import { CancelOrderModal } from "./orders/CancelOrderModal";
import { AddTransactionModal } from "./cashbox/AddTransactionModal";
import type { AddTxDraft } from "./cashbox/AddTransactionModal";
import { CloseSessionModal, OpenSessionModal, OpeningEditModal, SessionReportModal } from "./cashbox/SessionModals";
import { CorrectTxModal } from "./cashbox/CorrectTxModal";
import { PERIOD_OPTIONS, periodRange } from "./cashbox/cashbox-utils";
import type { PeriodKey } from "./cashbox/cashbox-utils";

const TYPE_STYLE: Record<OgtCashboxTxType, string> = {
  income: "border-green-200 bg-green-50 text-green-700",
  expense: "border-red-200 bg-red-50 text-red-700",
  adjustment: "border-amber-200 bg-amber-50 text-amber-700",
  deposit: "border-blue-200 bg-blue-50 text-blue-700",
  withdrawal: "border-purple-200 bg-purple-50 text-purple-700",
};

interface LocalToast {
  id: number;
  title: string;
  body?: string;
  tone: "ok" | "error";
}

let toastSeq = 0;

export function CashboxSection({
  user,
  focusTxId,
  onClearFocus,
}: {
  user: OgtUser;
  focusTxId?: number | null;
  onClearFocus?: () => void;
}) {
  const canManage = canManageCashbox(user.role);
  const canOrders = canManageOrders(user.role);

  const [period, setPeriod] = useState<PeriodKey>("today");
  const [type, setType] = useState<string>("all");
  const [method, setMethod] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [limit, setLimit] = useState(200);

  const [summary, setSummary] = useState<OgtCashboxSummary | null>(null);
  const [rows, setRows] = useState<OgtCashboxTx[]>([]);
  const [total, setTotal] = useState(0);
  const [sessions, setSessions] = useState<OgtCashboxSession[]>([]);
  const [userOptions, setUserOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<LocalToast[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showOpeningEdit, setShowOpeningEdit] = useState(false);
  const [correctTarget, setCorrectTarget] = useState<OgtCashboxTx | null>(null);
  const [report, setReport] = useState<OgtCashboxSessionDetail | null>(null);

  const [thresholds, setThresholds] = useState<OgtLateThresholds>({ ...DEFAULT_LATE_MINUTES });
  const [products, setProducts] = useState<Map<number, string>>(new Map());
  const [orderDetail, setOrderDetail] = useState<OgtOrderDetail | null>(null);
  const [orderDetailId, setOrderDetailId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OgtOrderDetail["order"] | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    void window.ogt.orders
      .thresholds()
      .then(setThresholds)
      .catch(() => undefined);
    void window.ogt.products
      .list()
      .then((list) => {
        const map = new Map<number, string>();
        for (const p of list) {
          const url = String(p.imageUrl ?? "").trim();
          if (/^https:\/\//i.test(url)) map.set(p.id, url);
        }
        setProducts(map);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      const { from, to } = periodRange(period);
      const [sum, listRes, sess] = await Promise.all([
        window.ogt.cashbox.summary({ from, to }),
        window.ogt.cashbox.list({
          from,
          to,
          type,
          method: method || undefined,
          source: source || undefined,
          user: userFilter || undefined,
          search: searchDebounced || undefined,
          limit,
        }),
        window.ogt.cashbox.sessions(),
      ]);
      setSummary(sum);
      setRows(listRes.rows);
      setTotal(listRes.total);
      setSessions(sess);
      setError(null);
      setLastUpdated(Date.now());
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل بيانات الصندوق");
      setLoading(false);
    }
  }, [period, type, method, source, userFilter, searchDebounced, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    window.ogt.cashbox
      .list({ limit: 500 })
      .then((res) => {
        const set = new Set<string>();
        for (const r of res.rows) if (r.userName) set.add(r.userName);
        setUserOptions([...set].sort((a, b) => a.localeCompare(b, "ar")));
      })
      .catch(() => undefined);
  }, []);

  const notify = useCallback((title: string, body?: string, tone: "ok" | "error" = "ok") => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev.slice(-3), { id, title, body, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const periodTotal = summary?.period;
  const periodIn =
    (periodTotal?.incomeCents ?? 0) +
    (periodTotal?.depositCents ?? 0) +
    (periodTotal?.adjustmentInCents ?? 0);
  const periodOut =
    (periodTotal?.expenseCents ?? 0) +
    (periodTotal?.withdrawalCents ?? 0) +
    (periodTotal?.adjustmentOutCents ?? 0);
  const periodNet = periodIn - periodOut;

  const activeUsers = useMemo(
    () => [...new Set([...userOptions, ...rows.map((r) => r.userName).filter(Boolean)])].sort((a, b) => a.localeCompare(b, "ar")),
    [userOptions, rows],
  );

  function clearFilters() {
    setType("all");
    setMethod("");
    setSource("");
    setUserFilter("");
    setSearch("");
  }

  const hasFilters = type !== "all" || method !== "" || source !== "" || userFilter !== "" || search !== "";

  async function run(fn: () => Promise<unknown>, failTitle: string, okTitle?: string) {
    setBusy(true);
    try {
      await fn();
      if (okTitle) notify(okTitle);
      await load();
    } catch (err) {
      notify(failTitle, err instanceof Error ? err.message : "خطأ غير متوقع", "error");
    } finally {
      setBusy(false);
    }
  }

  function onAdd(draft: AddTxDraft) {
    setShowAdd(false);
    void run(
      () => window.ogt.cashbox.add(draft),
      "تعذر إضافة العملية",
      "تمت إضافة العملية",
    );
  }

  function onOpenSession(openingBalanceCents: number, note?: string) {
    setShowOpen(false);
    void run(
      () => window.ogt.cashbox.openSession({ openingBalanceCents, note }),
      "تعذر فتح الصندوق",
      "تم فتح الصندوق",
    );
  }

  function onEditOpening(openingBalanceCents: number) {
    if (!summary?.openSession) return;
    const id = summary.openSession.id;
    setShowOpeningEdit(false);
    void run(
      () => window.ogt.cashbox.updateOpening({ sessionId: id, openingBalanceCents }),
      "تعذر تعديل الرصيد",
      "تم تعديل الرصيد الافتتاحي",
    );
  }

  async function openCloseModal() {
    const session = summary?.openSession;
    if (!session) return;
    setBusy(true);
    try {
      const res = await window.ogt.cashbox.list({ from: session.openedAt, to: Date.now(), limit: 500 });
      const expected = res.rows
        .filter((r) => r.status === "active")
        .reduce((s, r) => s + txEffectCents(r), 0) + session.openingBalanceCents;
      closeExpectedRef.current = expected;
      setShowClose(true);
    } catch (err) {
      notify("تعذر حساب المتوقع", err instanceof Error ? err.message : "خطأ غير متوقع", "error");
    } finally {
      setBusy(false);
    }
  }

  const closeExpectedRef = useRef(0);

  function onCloseSession(actualCents: number, reason: string) {
    if (!summary?.openSession) return;
    const id = summary.openSession.id;
    setShowClose(false);
    void run(
      () => window.ogt.cashbox.closeSession({ sessionId: id, actualCents, reason }),
      "تعذر إغلاق الصندوق",
      "تم إغلاق الصندوق",
    );
  }

  function onCorrect(reason: string) {
    if (!correctTarget) return;
    const tx = correctTarget;
    setCorrectTarget(null);
    void run(
      () => window.ogt.cashbox.correct({ txId: tx.id, reason }),
      "تعذر التصحيح",
      "تم تصحيح العملية",
    );
  }

  async function openReport(sessionId: number) {
    setBusy(true);
    try {
      const d = await window.ogt.cashbox.sessionDetail(sessionId);
      if (d) setReport(d);
    } catch (err) {
      notify("تعذر فتح التقرير", err instanceof Error ? err.message : "خطأ غير متوقع", "error");
    } finally {
      setBusy(false);
    }
  }

  async function openOrder(id: number) {
    setOrderDetailId(id);
    setOrderDetail(null);
    try {
      const d = await window.ogt.orders.detail(id);
      if (d) setOrderDetail(d);
    } catch (err) {
      notify("تعذر فتح الطلب", err instanceof Error ? err.message : "خطأ غير متوقع", "error");
      setOrderDetailId(null);
    }
  }

  function closeOrder() {
    setOrderDetailId(null);
    setOrderDetail(null);
  }

  async function orderAction(fn: () => Promise<unknown>, failTitle: string) {
    setBusy(true);
    try {
      await fn();
      if (orderDetailId != null) await openOrder(orderDetailId);
      await load();
    } catch (err) {
      notify(failTitle, err instanceof Error ? err.message : "خطأ غير متوقع", "error");
    } finally {
      setBusy(false);
    }
  }

  const maxBar = useMemo(() => {
    let m = 0;
    for (const d of summary?.byDay ?? []) m = Math.max(m, d.inCents, d.outCents);
    return m || 1;
  }, [summary]);

  const openSession = summary?.openSession ?? null;
  const lastClosed = sessions.find((s) => s.status === "closed") ?? null;

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-foreground">
            <Wallet className="size-6 text-accent" />
            صندوق النقود
          </h1>
          <p className="text-xs font-bold text-muted">
            {loading ? "جاري التحميل..." : `${total} عملية في السجل${lastUpdated ? ` · آخر تحديث ${formatTime(lastUpdated)}` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {openSession ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-black text-green-700">
              <span className="size-2 rounded-full bg-green-500" />
              الصندوق مفتوح
            </span>
          ) : (
            <button
              onClick={() => setShowOpen(true)}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
            >
              <Unlock className="size-4" />
              فتح صندوق جديد
            </button>
          )}
          <button
            onClick={() => void load()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-card-2 hover:text-foreground"
            title="تحديث"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            <Plus className="size-4" />
            إضافة عملية
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 shadow-soft">
          <p className="text-[11px] font-bold text-muted">الرصيد الحالي</p>
          <p className="mt-1 truncate text-2xl font-black tabular-nums text-accent-strong">{formatMoney(summary?.currentBalanceCents ?? 0)}</p>
          <p className="text-[11px] font-semibold text-muted">دج</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
          <p className="text-[11px] font-bold text-muted">مبيعات الفترة</p>
          <p className="mt-1 truncate text-xl font-black tabular-nums text-foreground">{formatMoney(summary?.salesCents ?? 0)}</p>
          <p className="text-[11px] font-semibold text-muted">دج · {summary?.paidOrders ?? 0} طلب مدفوع</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-soft">
          <p className="text-[11px] font-bold text-green-700">دخل الفترة</p>
          <p className="mt-1 truncate text-xl font-black tabular-nums text-green-700">{formatMoney(periodIn)}</p>
          <p className="text-[11px] font-semibold text-green-600">دج</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-soft">
          <p className="text-[11px] font-bold text-red-700">مصروف الفترة</p>
          <p className="mt-1 truncate text-xl font-black tabular-nums text-red-700">{formatMoney(periodOut)}</p>
          <p className="text-[11px] font-semibold text-red-600">دج</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
          <p className="text-[11px] font-bold text-muted">صافي الحركة</p>
          <p className={`mt-1 truncate text-xl font-black tabular-nums ${periodNet >= 0 ? "text-foreground" : "text-red-700"}`}>
            {periodNet >= 0 ? "+" : ""}
            {formatMoney(periodNet)}
          </p>
          <p className="text-[11px] font-semibold text-muted">دج</p>
        </div>
      </div>

      {openSession ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 shadow-soft">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-green-800">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-green-500" />
              مفتوح منذ {formatTime(openSession.openedAt)} ({formatRelative(openSession.openedAt)})
            </span>
            <span>
              الافتتاحي: <span className="tabular-nums">{formatMoney(openSession.openingBalanceCents)} دج</span>
            </span>
            <span>
              الفاتح: <span>{openSession.openedByName || "system"}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                onClick={() => setShowOpeningEdit(true)}
                disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-green-300 bg-white px-3 text-xs font-bold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
              >
                <Lock className="size-3.5" />
                تعديل الافتتاحي
              </button>
            )}
            {canManage && (
              <button
                onClick={() => void openCloseModal()}
                disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-green-300 bg-white px-3 text-xs font-bold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
              >
                <CircleCheck className="size-4" />
                إغلاق الصندوق
              </button>
            )}
          </div>
        </div>
      ) : lastClosed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-xs font-semibold text-muted shadow-soft">
          <span className="inline-flex items-center gap-1.5">
            <CircleCheck className="size-4 text-green-600" />
            آخر إغلاق {formatRelative(lastClosed.closedAt ?? lastClosed.openedAt)} · متوقع{" "}
            <span className="tabular-nums">{formatMoney(lastClosed.expectedCents)}</span> · فعلي{" "}
            <span className="tabular-nums">{formatMoney(lastClosed.actualCents)}</span>
          </span>
          <span className={`font-black tabular-nums ${lastClosed.diffCents >= 0 ? "text-green-700" : "text-red-700"}`}>
            الفرق {lastClosed.diffCents >= 0 ? "+" : ""}
            {formatMoney(lastClosed.diffCents)} دج
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-soft">
        <div className="flex flex-wrap gap-1">
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setPeriod(o.key)}
              className={`h-8 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                period === o.key ? "bg-accent text-white" : "text-muted hover:bg-card-2 hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="relative ms-auto min-w-44 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم العملية، الملاحظة، الطلب، المستخدم…"
            className="h-9 w-full rounded-xl border border-transparent bg-card-2/60 ps-9 pe-3 text-xs font-semibold outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 rounded-xl border border-line bg-surface px-2 text-xs font-bold text-foreground outline-none focus:border-accent"
        >
          <option value="all">كل الأنواع</option>
          {CASHBOX_TX_TYPES.map((t) => (
            <option key={t} value={t}>
              {CASHBOX_TX_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="h-9 rounded-xl border border-line bg-surface px-2 text-xs font-bold text-foreground outline-none focus:border-accent"
        >
          <option value="">كل الطرق</option>
          {CASHBOX_METHODS.map((m) => (
            <option key={m} value={m}>
              {CASHBOX_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="h-9 rounded-xl border border-line bg-surface px-2 text-xs font-bold text-foreground outline-none focus:border-accent"
        >
          <option value="">كل المصادر</option>
          <option value="order">طلبات</option>
          <option value="manual">يدوي</option>
        </select>
        {activeUsers.length > 0 && (
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="h-9 rounded-xl border border-line bg-surface px-2 text-xs font-bold text-foreground outline-none focus:border-accent"
          >
            <option value="">كل المستخدمين</option>
            {activeUsers.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground"
          >
            <Filter className="size-3.5" />
            مسح الفلاتر
          </button>
        )}
      </div>

      {summary && summary.byDay.length > 0 && (
        <div className="grid gap-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft lg:col-span-2">
            <h3 className="mb-3 text-xs font-black text-muted">حركة الفترة (داخل / خارج)</h3>
            <div className="flex h-28 items-end gap-2">
              {summary.byDay.map((d) => (
                <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="flex h-20 w-full items-end justify-center gap-0.5">
                    <div
                      className="w-2.5 rounded-t bg-green-400"
                      style={{ height: `${Math.max(4, Math.round((d.inCents / maxBar) * 100))}%` }}
                      title={`${d.label}: داخل ${formatMoney(d.inCents)}`}
                    />
                    <div
                      className="w-2.5 rounded-t bg-red-400"
                      style={{ height: `${Math.max(4, Math.round((d.outCents / maxBar) * 100))}%` }}
                      title={`${d.label}: خارج ${formatMoney(d.outCents)}`}
                    />
                  </div>
                  <span className="truncate text-[10px] font-semibold text-muted">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
            <h3 className="mb-2 text-xs font-black text-muted">توزيع العمليات</h3>
            <ul className="space-y-1.5">
              {summary.byType.map((b) => (
                <li key={b.type} className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${TYPE_STYLE[b.type].split(" ")[1]}`} />
                    {CASHBOX_TX_LABELS[b.type]}
                    <span className="font-semibold text-muted">({b.count})</span>
                  </span>
                  <span className="font-black tabular-nums">{formatMoney(b.amountCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-surface shadow-soft">
        {loading && rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm font-bold text-muted">
            جاري تحميل السجل...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm font-bold text-muted">
            لا توجد عمليات مطابقة
          </div>
        ) : (
          <table className="w-full min-w-[820px] text-start text-xs">
            <thead>
              <tr className="border-b border-line text-[11px] font-black text-muted">
                <th className="px-3 py-2 text-start">#</th>
                <th className="px-3 py-2 text-start">التاريخ</th>
                <th className="px-3 py-2 text-start">النوع</th>
                <th className="px-3 py-2 text-start">المبلغ</th>
                <th className="px-3 py-2 text-start">الطريقة</th>
                <th className="px-3 py-2 text-start">المصدر</th>
                <th className="px-3 py-2 text-start">المستخدم</th>
                <th className="px-3 py-2 text-start">ملاحظة</th>
                <th className="px-3 py-2 text-end">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-line/60 transition-colors last:border-0 hover:bg-card-2/40 ${
                    focusTxId === r.id ? "bg-accent/10 ring-1 ring-accent" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-black tabular-nums text-muted">{r.txNumber}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-muted">
                    {new Date(r.createdAt).toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit" })}{" "}
                    {formatTime(r.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${TYPE_STYLE[r.type]}`}>
                        {CASHBOX_TX_LABELS[r.type]}
                      </span>
                      {r.status === "reversed" && (
                        <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[9px] font-black text-gray-500">
                          مصححة
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 font-black tabular-nums ${r.direction === "in" ? "text-green-700" : "text-red-700"}`}>
                    {r.direction === "in" ? "+" : "-"} {formatMoney(r.amountCents)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-muted">
                    {CASHBOX_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.orderId != null ? (
                      <button
                        onClick={() => void openOrder(r.orderId as number)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-black text-accent-strong transition-colors hover:bg-accent/10"
                      >
                        <Receipt className="size-3" />
                        طلب #{r.orderId}
                      </button>
                    ) : (
                      <span className="font-semibold text-muted">يدوي</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-muted">{r.userName || "system"}</td>
                  <td className="max-w-52 truncate px-3 py-2 font-semibold text-muted">{r.note || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-end">
                    {r.status === "active" && r.source !== "order" && canManage && (
                      <button
                        onClick={() => setCorrectTarget(r)}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 transition-colors hover:bg-amber-100"
                      >
                        تصحيح
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && total > rows.length && (
          <div className="border-t border-line p-2 text-center">
            <button
              onClick={() => setLimit((l) => l + 200)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-xs font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground"
            >
              عرض المزيد ({rows.length} من {total})
            </button>
          </div>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
          <h3 className="mb-2 text-xs font-black text-muted">سجل الإغلاقات</h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {sessions.slice(0, 6).map((s) => (
              <li
                key={s.id}
                onClick={() => (s.status === "closed" ? void openReport(s.id) : undefined)}
                className={`rounded-xl border border-line/70 bg-card-2/40 px-3 py-2 text-[11px] font-semibold text-muted ${
                  s.status === "closed" ? "cursor-pointer transition-colors hover:border-accent hover:bg-accent/5" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-foreground">
                    {s.status === "open" ? "مفتوح" : "مغلق"} ·{" "}
                    {new Date(s.openedAt).toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit" })}
                  </span>
                  <span className="tabular-nums">افتتاحي {formatMoney(s.openingBalanceCents)}</span>
                </div>
                {s.status === "closed" && (
                  <div className="mt-0.5 flex items-center justify-between">
                    <span>
                      متوقع {formatMoney(s.expectedCents)} · فعلي {formatMoney(s.actualCents)}
                    </span>
                    <span className={`font-black tabular-nums ${s.diffCents >= 0 ? "text-green-700" : "text-red-700"}`}>
                      الفرق {s.diffCents >= 0 ? "+" : ""}
                      {formatMoney(s.diffCents)}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showAdd && <AddTransactionModal busy={busy} onClose={() => setShowAdd(false)} onConfirm={onAdd} />}
      {showOpen && (
        <OpenSessionModal
          suggestedCents={summary?.currentBalanceCents ?? 0}
          busy={busy}
          onClose={() => setShowOpen(false)}
          onConfirm={onOpenSession}
        />
      )}
      {showClose && openSession && (
        <CloseSessionModal
          session={openSession}
          expectedCents={closeExpectedRef.current}
          busy={busy}
          onClose={() => setShowClose(false)}
          onConfirm={onCloseSession}
        />
      )}
      {showOpeningEdit && openSession && (
        <OpeningEditModal
          session={openSession}
          busy={busy}
          onClose={() => setShowOpeningEdit(false)}
          onConfirm={onEditOpening}
        />
      )}
      {correctTarget && (
        <CorrectTxModal tx={correctTarget} busy={busy} onClose={() => setCorrectTarget(null)} onConfirm={onCorrect} />
      )}

      {report && (
        <SessionReportModal
          detail={report}
          onClose={() => setReport(null)}
          onOpenOrder={(id) => {
            setReport(null);
            void openOrder(id);
          }}
        />
      )}

      {orderDetail && orderDetailId != null && (
        <div className="absolute inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={closeOrder} />
          <div className="relative z-10 h-full w-full max-w-md rounded-s-2xl border border-line bg-background shadow-card">
            <OrderDetailPanel
              detail={orderDetail}
              thresholds={thresholds}
              products={products}
              canManage={canOrders}
              busy={busy}
              onClose={closeOrder}
              onAdvance={(id, to) => void orderAction(() => window.ogt.orders.updateStatus(id, to), "تعذر تحديث الطلب")}
              onCancel={setCancelTarget}
              onPriority={(id, p) => void orderAction(() => window.ogt.orders.setPriority(id, p), "تعذر تغيير الأولوية")}
              onTogglePayment={(id) => void orderAction(() => window.ogt.orders.setPayment(id, orderDetail.order.paymentStatus === "paid" ? "unpaid" : "paid"), "تعذر تغيير حالة الدفع")}
              onToast={(msg) => notify(msg)}
            />
          </div>
        </div>
      )}

      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          busy={busy}
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) => {
            const id = cancelTarget.id;
            setCancelTarget(null);
            void orderAction(() => window.ogt.orders.updateStatus(id, "cancelled", { reason }), "تعذر إلغاء الطلب");
          }}
        />
      )}

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed start-1/2 top-16 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
          {toasts.map((t) => (
            <button
              key={t.id}
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className={`pointer-events-auto flex items-start gap-2 rounded-2xl border px-4 py-3 text-start shadow-card ${
                t.tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-surface text-foreground"
              }`}
            >
              {t.tone === "error" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
              ) : (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-black">{t.title}</span>
                {t.body && <span className="block text-xs font-semibold text-muted">{t.body}</span>}
              </span>
              <X className="ms-auto mt-0.5 size-3.5 shrink-0 text-muted" />
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
