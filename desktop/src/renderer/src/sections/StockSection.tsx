import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Bell,
  ListChecks,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type {
  OgtProductIngredientView,
  OgtStockItem,
  OgtStockItemInput,
  OgtStockItemStatus,
  OgtStockItemWithStatus,
  OgtStockMovement,
  OgtStockMovementInput,
  OgtStockMovementKind,
  OgtStockSummary,
} from "@shared/types";
import {
  STOCK_ITEM_TYPES,
  STOCK_KIND_LABELS,
  STOCK_MOVEMENT_KINDS,
  STOCK_TYPE_LABELS,
} from "@lib/stock";
import { canManageStock } from "@lib/perms";
import { formatMoney, formatTime } from "../format";
import { Button, Modal, SelectField, Spinner, TextField } from "../components/ui";
import { ItemModal } from "./stock/ItemModal";
import { MoveModal } from "./stock/MoveModal";
import type { ManualKind } from "./stock/MoveModal";
import { RecipeModal } from "./stock/RecipeModal";

let toastSeq = 0;

type TabKey = "items" | "movements" | "ingredients";

const STATUS_BADGE: Record<OgtStockItemStatus, string> = {
  available: "border-green-200 bg-green-50 text-green-700",
  low: "border-amber-200 bg-amber-50 text-amber-700",
  out: "border-red-200 bg-red-50 text-red-700",
};

const STATUS_LABEL: Record<OgtStockItemStatus, string> = {
  available: "متوفر",
  low: "منخفض",
  out: "نافد",
};

const KIND_BADGE: Record<OgtStockMovementKind, string> = {
  in: "border-green-200 bg-green-50 text-green-700",
  out: "border-red-200 bg-red-50 text-red-700",
  adjust: "border-slate-200 bg-slate-100 text-slate-700",
  count: "border-violet-200 bg-violet-50 text-violet-700",
  sale: "border-amber-200 bg-amber-50 text-amber-700",
  restore: "border-teal-200 bg-teal-50 text-teal-700",
};

function fmtQty(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function StatusBadge({ status }: { status: OgtStockItemStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${STATUS_BADGE[status]}`}>
      <span
        className={`size-1.5 rounded-full ${
          status === "available" ? "bg-green-500" : status === "low" ? "bg-amber-500" : "bg-red-500"
        }`}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function KindBadge({ kind }: { kind: OgtStockMovementKind }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-black ${KIND_BADGE[kind]}`}>
      {STOCK_KIND_LABELS[kind]}
    </span>
  );
}

export function StockSection({ user }: { user: { role: string } }) {
  const canManage = canManageStock(user.role as never);
  const [tab, setTab] = useState<TabKey>("items");

  const [summary, setSummary] = useState<OgtStockSummary | null>(null);
  const [items, setItems] = useState<OgtStockItemWithStatus[]>([]);
  const [movements, setMovements] = useState<{ rows: OgtStockMovement[]; total: number }>({ rows: [], total: 0 });
  const [ingredients, setIngredients] = useState<OgtProductIngredientView[]>([]);

  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [kindFilter, setKindFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [movSearch, setMovSearch] = useState("");
  const [ingSearch, setIngSearch] = useState("");

  const [loaded, setLoaded] = useState({ items: false, movements: false, ingredients: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; title: string; body?: string; tone: "ok" | "error" }>>([]);

  const [itemModal, setItemModal] = useState<OgtStockItemWithStatus | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ item: OgtStockItemWithStatus; kind: ManualKind } | null>(null);
  const [recipeTarget, setRecipeTarget] = useState<OgtProductIngredientView | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const notify = useCallback((title: string, body?: string, tone: "ok" | "error" = "ok") => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, title, body, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const [sum, list] = await Promise.all([
        window.ogt.stock.summary(),
        window.ogt.stock.list({ type: typeFilter as never, search: searchDebounced, archived: showArchived ? 1 : 0 }),
      ]);
      setSummary(sum);
      setItems(list);
      setLoaded((l) => ({ ...l, items: true }));
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الستوك");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, searchDebounced, showArchived]);

  const loadMovements = useCallback(async () => {
    try {
      const res = await window.ogt.stock.movements({
        kind: kindFilter as never,
        user: userFilter || undefined,
        search: movSearch || undefined,
        limit: 300,
      });
      setMovements(res);
      setLoaded((l) => ({ ...l, movements: true }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الحركات");
    }
  }, [kindFilter, userFilter, movSearch]);

  const loadIngredients = useCallback(async () => {
    try {
      const list = await window.ogt.stock.ingredients();
      setIngredients(list);
      setLoaded((l) => ({ ...l, ingredients: true }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل المكونات");
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (tab === "movements" && !loaded.movements) void loadMovements();
  }, [tab, loaded.movements, loadMovements]);

  useEffect(() => {
    if (tab === "ingredients" && !loaded.ingredients) void loadIngredients();
  }, [tab, loaded.ingredients, loadIngredients]);

  function refresh() {
    setLoading(true);
    void loadItems();
    if (tab === "movements") void loadMovements();
    if (tab === "ingredients") void loadIngredients();
  }

  function switchTab(next: TabKey) {
    setTab(next);
    setError(null);
  }

  async function run(fn: () => Promise<unknown>, failTitle: string, okTitle?: string) {
    setBusy(true);
    try {
      await fn();
      if (okTitle) notify(okTitle);
      setBusy(false);
      refresh();
      return true;
    } catch (err) {
      setBusy(false);
      notify(failTitle, err instanceof Error ? err.message : "خطأ غير متوقع", "error");
      return false;
    }
  }

  function onItemSave(input: OgtStockItemInput) {
    void run(
      () => (itemModal ? window.ogt.stock.update({ ...input, id: itemModal.id }) : window.ogt.stock.create(input)),
      itemModal ? "تعذر تحديث الصنف" : "تعذر إضافة الصنف",
      itemModal ? "تم تحديث الصنف" : "تمت إضافة الصنف",
    ).then((ok) => {
      if (ok) {
        setShowItemModal(false);
        setItemModal(null);
      }
    });
  }

  function onArchive(item: OgtStockItem) {
    if (!window.confirm(`أرشفة الصنف "${item.name}"؟ لن يظهر في القائمة النشطة.`)) return;
    void run(() => window.ogt.stock.archive({ id: item.id }), "تعذر أرشفة الصنف", "تمت الأرشفة");
  }

  function onMove(draft: OgtStockMovementInput) {
    void run(
      () => window.ogt.stock.move(draft),
      "تعذر تسجيل الحركة",
      draft.kind === "in" ? "تم تسجيل الإدخال" : draft.kind === "out" ? "تم تسجيل الإخراج" : "تم تسجيل الحركة",
    ).then((ok) => {
      if (ok) setMoveTarget(null);
    });
  }

  function onRecipeSave(rows: { itemId: number; qty: number }[]) {
    if (!recipeTarget) return;
    void run(
      () => window.ogt.stock.setIngredients({ productId: recipeTarget.productId, items: rows }),
      "تعذر حفظ المكونات",
      "تم حفظ المكونات",
    ).then((ok) => {
      if (ok) {
        setRecipeTarget(null);
        setIngredients((prev) =>
          prev.map((p) =>
            p.productId === recipeTarget.productId
              ? {
                  ...p,
                  hasRecipes: rows.length > 0,
                  unavailable: rows.some(
                    (r) => (items.find((i) => i.id === r.itemId)?.status ?? "out") === "out",
                  ),
                  items: rows
                    .map((r) => {
                      const it = items.find((i) => i.id === r.itemId);
                      if (!it) return null;
                      return {
                        itemId: r.itemId,
                        name: it.name,
                        unit: it.unit,
                        qty: r.qty,
                        quantity: it.quantity,
                        minQuantity: it.minQuantity,
                        status: it.status,
                      };
                    })
                    .filter((x): x is NonNullable<typeof x> => x != null),
                }
              : p,
          ),
        );
      }
    });
  }

  const reorderItems = summary?.reorderItems ?? [];
  const filteredMovements = useMemo(() => {
    const q = movSearch.trim().toLowerCase();
    if (!q) return movements.rows;
    return movements.rows.filter(
      (m) =>
        m.itemName.toLowerCase().includes(q) ||
        m.note.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q) ||
        (m.refId != null ? String(m.refId) : "").includes(q),
    );
  }, [movements.rows, movSearch]);

  const userOptions = useMemo(() => {
    const s = new Set<string>();
    for (const m of movements.rows) if (m.userName) s.add(m.userName);
    return [...s].sort();
  }, [movements.rows]);

  const filteredIngredients = useMemo(() => {
    const q = ingSearch.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((p) => p.name.toLowerCase().includes(q));
  }, [ingredients, ingSearch]);

  const unavailableProducts = useMemo(
    () => filteredIngredients.filter((p) => !p.isHidden && p.hasRecipes && p.unavailable),
    [filteredIngredients],
  );

  const tabButton = (key: TabKey, label: string) => (
    <button
      key={key}
      onClick={() => switchTab(key)}
      className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${
        tab === key ? "bg-accent/15 text-accent-strong" : "text-muted hover:bg-card-2 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-foreground">
            <Package className="size-6 text-accent" />
            الستوك
          </h1>
          <p className="text-xs font-bold text-muted">
            {loading ? "جاري التحميل..." : `${items.length} صنف نشط${lastUpdated ? ` · آخر تحديث ${formatTime(lastUpdated)}` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reorderItems.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700">
              <AlertTriangle className="size-3.5" />
              {reorderItems.length} صنف يحتاج إعادة طلب
            </span>
          )}
          <button
            onClick={refresh}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-card-2 hover:text-foreground"
            title="تحديث"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {canManage && (
            <button
              onClick={() => {
                setItemModal(null);
                setShowItemModal(true);
              }}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
            >
              <Plus className="size-4" />
              إضافة صنف
            </button>
          )}
        </div>
      </header>

      <div className="flex items-center gap-1">
        {tabButton("items", "المخزون")}
        {tabButton("movements", "الحركات")}
        {tabButton("ingredients", "مكونات الأطباق")}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
          <p className="text-[11px] font-bold text-muted">عدد الأصناف</p>
          <p className="mt-1 truncate text-2xl font-black tabular-nums text-foreground">{summary?.totalItems ?? 0}</p>
          <p className="text-[11px] font-semibold text-muted">صنف نشط</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft">
          <p className="text-[11px] font-bold text-amber-700">أصناف منخفضة</p>
          <p className="mt-1 truncate text-2xl font-black tabular-nums text-amber-700">{summary?.lowItems ?? 0}</p>
          <p className="text-[11px] font-semibold text-amber-600">أقل من الحد الأدنى</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-soft">
          <p className="text-[11px] font-bold text-red-700">أصناف نافدة</p>
          <p className="mt-1 truncate text-2xl font-black tabular-nums text-red-700">{summary?.outItems ?? 0}</p>
          <p className="text-[11px] font-semibold text-red-600">الكمية صفر أو أقل</p>
        </div>
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 shadow-soft">
          <p className="text-[11px] font-bold text-muted">قيمة الستوك</p>
          <p className="mt-1 truncate text-2xl font-black tabular-nums text-accent-strong">{formatMoney(summary?.stockValueCents ?? 0)}</p>
          <p className="text-[11px] font-semibold text-muted">دج · حسب سعر الوحدة</p>
        </div>
      </div>

      {tab === "items" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {reorderItems.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-soft">
              <p className="flex items-center gap-1.5 text-sm font-black text-red-800">
                <Sparkles className="size-4" />
                يحتاج إلى إعادة طلب
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {reorderItems.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setMoveTarget({ item: r, kind: "in" })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                    title="تسجيل إدخال"
                  >
                    {r.name} · <span className="tabular-nums">{fmtQty(r.quantity)}</span> {r.unit}
                    <ArrowDownToLine className="size-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو المورد..."
                className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm font-semibold outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <SelectField className="w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">كل الأنواع</option>
              {STOCK_ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {STOCK_TYPE_LABELS[t]}
                </option>
              ))}
            </SelectField>
            {canManage && (
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-muted">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="size-4 accent-amber-500"
                />
                الأرشيف
              </label>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-line bg-surface shadow-soft">
            {loading && !loaded.items ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner label="جاري التحميل..." />
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted">
                <Boxes className="size-8" />
                <p className="text-sm font-bold">لا توجد أصناف في المخزون</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-start text-[11px] font-black text-muted">
                    <th className="px-4 py-3 text-start">الصنف</th>
                    <th className="px-4 py-3 text-start">النوع</th>
                    <th className="px-4 py-3 text-start">الكمية</th>
                    <th className="px-4 py-3 text-start">الحد الأدنى</th>
                    <th className="px-4 py-3 text-start">الحالة</th>
                    <th className="px-4 py-3 text-end">القيمة</th>
                    <th className="px-4 py-3 text-end">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-line/60 last:border-0 hover:bg-card-2/50">
                      <td className="px-4 py-3">
                        <p className="font-black text-foreground">{item.name}</p>
                        <p className="text-[11px] font-bold text-muted">
                          {item.supplier ? `المورد: ${item.supplier}` : "بدون مورد"}
                          {item.note ? ` · ${item.note}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-bold text-muted">{STOCK_TYPE_LABELS[item.type]}</td>
                      <td className="px-4 py-3 font-black tabular-nums text-foreground">
                        {fmtQty(item.quantity)} <span className="text-[11px] font-bold text-muted">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums text-muted">{fmtQty(item.minQuantity)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-end font-bold tabular-nums text-foreground">{formatMoney(item.valueCents)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setMoveTarget({ item, kind: "in" })}
                            disabled={busy}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 text-[11px] font-bold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                            title="إدخال"
                          >
                            <ArrowDownToLine className="size-3.5" />
                            إدخال
                          </button>
                          <button
                            onClick={() => setMoveTarget({ item, kind: "out" })}
                            disabled={busy}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                            title="إخراج"
                          >
                            <ArrowUpFromLine className="size-3.5" />
                            إخراج
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => setMoveTarget({ item, kind: "count" })}
                                disabled={busy}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[11px] font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground disabled:opacity-50"
                                title="جرد / عد"
                              >
                                <ListChecks className="size-3.5" />
                                عد
                              </button>
                              <button
                                onClick={() => setMoveTarget({ item, kind: "adjust" })}
                                disabled={busy}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[11px] font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground disabled:opacity-50"
                                title="تسوية"
                              >
                                <SlidersHorizontal className="size-3.5" />
                                تسوية
                              </button>
                              <button
                                onClick={() => {
                                  setItemModal(item);
                                  setShowItemModal(true);
                                }}
                                disabled={busy}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-card-2 hover:text-foreground disabled:opacity-50"
                                title="تعديل"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => onArchive(item)}
                                disabled={busy}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-card-2 hover:text-foreground disabled:opacity-50"
                                title="أرشفة"
                              >
                                <Archive className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "movements" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={movSearch}
                onChange={(e) => setMovSearch(e.target.value)}
                placeholder="ابحث عن صنف، طلب، أو ملاحظة..."
                className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm font-semibold outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <SelectField className="w-40" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="">كل الحركات</option>
              {STOCK_MOVEMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {STOCK_KIND_LABELS[k]}
                </option>
              ))}
            </SelectField>
            <SelectField className="w-40" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="">كل المستخدمين</option>
              {userOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-line bg-surface shadow-soft">
            {!loaded.movements ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner label="جاري التحميل..." />
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted">
                <Boxes className="size-8" />
                <p className="text-sm font-bold">لا توجد حركات مطابقة</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-start text-[11px] font-black text-muted">
                    <th className="px-4 py-3 text-start">التاريخ</th>
                    <th className="px-4 py-3 text-start">الصنف</th>
                    <th className="px-4 py-3 text-start">النوع</th>
                    <th className="px-4 py-3 text-start">التغيير</th>
                    <th className="px-4 py-3 text-start">الرصيد الجديد</th>
                    <th className="px-4 py-3 text-start">المرجع</th>
                    <th className="px-4 py-3 text-start">المستخدم</th>
                    <th className="px-4 py-3 text-start">السبب / ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((m) => (
                    <tr key={m.id} className="border-b border-line/60 last:border-0 hover:bg-card-2/50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-muted">
                        {fmtDate(m.createdAt)} {formatTime(m.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-black text-foreground">{m.itemName}</td>
                      <td className="px-4 py-3">
                        <KindBadge kind={m.kind} />
                      </td>
                      <td className={`px-4 py-3 font-black tabular-nums ${m.quantity >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {m.quantity >= 0 ? "+" : ""}
                        {fmtQty(m.quantity)}
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums text-foreground">{fmtQty(m.newQuantity)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-muted">
                        {m.refType === "order" && m.refId != null
                          ? `طلب #${m.refId}`
                          : m.invoice
                            ? `فاتورة ${m.invoice}`
                            : m.supplier
                              ? m.supplier
                              : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-muted">{m.userName || "—"}</td>
                      <td className="max-w-52 px-4 py-3 text-xs font-semibold text-muted">
                        {m.reason || m.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "ingredients" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {unavailableProducts.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-soft">
              <p className="flex items-center gap-1.5 text-sm font-black text-red-800">
                <AlertTriangle className="size-4" />
                {unavailableProducts.length} طبق قد يكون غير متوفر (مكوّن نافد)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unavailableProducts.map((p) => (
                  <span key={p.productId} className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-bold text-red-700">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="relative min-w-52">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={ingSearch}
              onChange={(e) => setIngSearch(e.target.value)}
              placeholder="ابحث عن طبق..."
              className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm font-semibold outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-line bg-surface shadow-soft">
            {!loaded.ingredients ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner label="جاري التحميل..." />
              </div>
            ) : filteredIngredients.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted">
                <Boxes className="size-8" />
                <p className="text-sm font-bold">لا توجد أطباق</p>
              </div>
            ) : (
              <div className="divide-y divide-line/60">
                {filteredIngredients.map((p) => (
                  <div key={p.productId} className={`flex items-start gap-3 px-4 py-3 ${p.unavailable ? "bg-red-50/50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-foreground">{p.name}</p>
                        {p.isHidden ? (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">مخفي</span>
                        ) : !p.isAvailable ? (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">غير متاح</span>
                        ) : p.unavailable && p.hasRecipes ? (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">مكوّن نافد</span>
                        ) : (
                          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-black text-green-700">متوفر</span>
                        )}
                        <span className="text-[11px] font-bold text-muted">{formatMoney(p.priceCents)} دج</span>
                      </div>
                      {p.hasRecipes ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {p.items.map((ing) => (
                            <span key={ing.itemId} className="inline-flex items-center gap-1 rounded-lg border border-line bg-card-2/60 px-2 py-0.5 text-[11px] font-bold text-muted">
                              {ing.name}
                              <span className="tabular-nums">{fmtQty(ing.qty)}</span>
                              <span>{ing.unit}</span>
                              <StatusBadge status={ing.status} />
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] font-bold text-muted">بدون مكونات — لن تُخصم الكميات عند الإكمال</p>
                      )}
                    </div>
                    {canManage && (
                      <button
                        onClick={() => setRecipeTarget(p)}
                        disabled={busy}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[11px] font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground disabled:opacity-50"
                      >
                        <Pencil className="size-3.5" />
                        تعديل المكونات
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showItemModal && (
        <ItemModal
          item={itemModal}
          busy={busy}
          onClose={() => {
            setShowItemModal(false);
            setItemModal(null);
          }}
          onConfirm={onItemSave}
        />
      )}

      {moveTarget && (
        <MoveModal
          item={moveTarget.item}
          kind={moveTarget.kind}
          busy={busy}
          onClose={() => setMoveTarget(null)}
          onConfirm={onMove}
        />
      )}

      {recipeTarget && (
        <RecipeModal
          product={recipeTarget}
          items={items.filter((i) => !i.archived)}
          busy={busy}
          onClose={() => setRecipeTarget(null)}
          onConfirm={onRecipeSave}
        />
      )}

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed start-1/2 top-16 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
          {toasts.map((t) => (
            <button
              key={t.id}
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className={`pointer-events-auto flex items-start gap-2 rounded-2xl border px-4 py-3 text-start shadow-card ${
                t.tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-surface text-foreground"
              }`}
            >
              <Bell className={`mt-0.5 size-4 shrink-0 ${t.tone === "error" ? "text-red-600" : "text-accent"}`} />
              <span className="min-w-0">
                <span className="block text-sm font-black">{t.title}</span>
                {t.body && <span className="block text-xs font-semibold text-muted">{t.body}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
