import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  AlertTriangle,
  Bell,
  CookingPot,
  Bike,
  CircleCheck,
  BadgeCheck,
  CalendarDays,
  Filter,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type {
  OgtCashboxTx,
  OgtOrder,
  OgtOrderDetail,
  OgtOrderPriority,
  OgtOrderStatus,
  OgtOrderSummary,
  OgtUser,
} from "@shared/types";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@lib/orders";
import { canManageOrders } from "@lib/perms";
import { formatTime } from "../format";
import type { OrdersBoard } from "../hooks/useOrdersBoard";
import { BoardColumn } from "./orders/BoardColumn";
import { OrderCardBody } from "./orders/OrderCard";
import { OrderDetailPanel } from "./orders/OrderDetailPanel";
import { CancelOrderModal } from "./orders/CancelOrderModal";
import { stageInfo } from "./orders/orders-utils";

const STAGE_COLUMNS: OgtOrderStatus[] = ["new", "preparing", "delivered", "completed", "cancelled"];

const COLUMN_ICON: Record<OgtOrderStatus, typeof Bell> = {
  new: Bell,
  preparing: CookingPot,
  delivered: Bike,
  completed: CircleCheck,
  cancelled: BadgeCheck,
};

type PriorityFilter = "all" | OgtOrderPriority;
type PaymentFilter = "all" | "unpaid" | "paid";
type DateFilter = "all" | "today" | "7d";

export function OrdersSection({
  user,
  board,
  onOpenCashbox,
}: {
  user: OgtUser;
  board: OrdersBoard;
  onOpenCashbox?: (txId: number) => void;
}) {
  const { orders, thresholds, loading, error, lastUpdated } = board;
  const canManage = canManageOrders(user.role);

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [date, setDate] = useState<DateFilter>("all");
  const [actor, setActor] = useState<string>("all");
  const [lateOnly, setLateOnly] = useState(false);

  const [activeOrder, setActiveOrder] = useState<OgtOrderSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const suppressClickRef = useRef(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OgtOrderDetail | null>(null);
  const [cashboxTx, setCashboxTx] = useState<OgtCashboxTx | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OgtOrder | null>(null);
  const [products, setProducts] = useState<Map<number, string>>(new Map());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
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
      .catch(() => {
        // images are optional
      });
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    const load = async () => {
      try {
        const d = await window.ogt.orders.detail(selectedId);
        if (!cancelled && d) setDetail(d);
      } catch {
        // ignore transient errors; poll will retry
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedId, lastUpdated]);

  useEffect(() => {
    if (selectedId == null) {
      setCashboxTx(null);
      return;
    }
    if (!canManage) return;
    let cancelled = false;
    window.ogt.cashbox
      .byOrder(selectedId)
      .then((res) => {
        if (!cancelled) setCashboxTx(res.tx[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setCashboxTx(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, lastUpdated, canManage]);

  const dayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const now = Date.now();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const weekAgo = now - 7 * 86400000;
    return orders.filter((o) => {
      if (q) {
        const hay = [String(o.id), o.customerName, o.customerPhone, o.items].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (priority !== "all" && o.priority !== priority) return false;
      if (payment !== "all" && o.paymentStatus !== payment) return false;
      if (date === "today" && o.createdAt < dayStart) return false;
      if (date === "7d" && o.createdAt < weekAgo) return false;
      if (actor !== "all" && o.lastActor !== actor) return false;
      if (lateOnly && !stageInfo(o, thresholds, now).late) return false;
      return true;
    });
  }, [orders, search, priority, payment, date, actor, lateOnly, thresholds, now, dayStart]);

  const grouped = useMemo(() => {
    const g: Record<OgtOrderStatus, OgtOrderSummary[]> = {
      new: [],
      preparing: [],
      delivered: [],
      completed: [],
      cancelled: [],
    };
    for (const o of filtered) g[o.status].push(o);
    for (const key of STAGE_COLUMNS) {
      g[key].sort((a, b) => {
        const al = stageInfo(a, thresholds, now).late ? 0 : 1;
        const bl = stageInfo(b, thresholds, now).late ? 0 : 1;
        if (al !== bl) return al - bl;
        return a.createdAt - b.createdAt;
      });
    }
    return g;
  }, [filtered, thresholds, now]);

  const lateCount = useMemo(
    () => orders.filter((o) => stageInfo(o, thresholds, now).late).length,
    [orders, thresholds, now],
  );

  const actorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) if (o.lastActor) set.add(o.lastActor);
    return [...set].sort((a, b) => a.localeCompare(b, "ar"));
  }, [orders]);

  function findColumnOf(id: string): OgtOrderStatus | null {
    if (STAGE_COLUMNS.includes(id as OgtOrderStatus)) return id as OgtOrderStatus;
    const o = orders.find((x) => String(x.id) === id);
    return o ? o.status : null;
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const col = findColumnOf(id);
    const order = col ? orders.find((o) => String(o.id) === id) ?? null : null;
    setActiveOrder(order);
  }

  function handleDragEnd(event: DragEndEvent) {
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 120);
    const overId = event.over ? String(event.over.id) : null;
    const to = overId ? findColumnOf(overId) : null;
    const id = Number(event.active.id);
    const order = orders.find((o) => o.id === id);
    if (to && order && to !== "cancelled" && order.status !== to) {
      void moveOrder(id, to);
    }
    setActiveOrder(null);
  }

  async function moveOrder(id: number, to: OgtOrderStatus) {
    board.patchOrder(id, { status: to, updatedAt: Date.now() });
    setBusy(true);
    try {
      await window.ogt.orders.updateStatus(id, to);
    } catch (err) {
      board.notify("تعذر نقل الطلب", err instanceof Error ? err.message : "خطأ غير متوقع", "error");
      await board.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function advance(id: number, to: OgtOrderStatus) {
    setBusy(true);
    try {
      await window.ogt.orders.updateStatus(id, to);
      board.patchOrder(id, { status: to, updatedAt: Date.now() });
    } catch (err) {
      board.notify("تعذر تحديث الطلب", err instanceof Error ? err.message : "خطأ غير متوقع", "error");
      await board.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel(reason: string) {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    setCancelTarget(null);
    setBusy(true);
    try {
      await window.ogt.orders.updateStatus(id, "cancelled", { reason });
      board.patchOrder(id, { status: "cancelled", cancelReason: reason, paymentStatus: "unpaid", updatedAt: Date.now() });
    } catch (err) {
      board.notify("تعذر إلغاء الطلب", err instanceof Error ? err.message : "خطأ غير متوقع", "error");
      await board.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function changePriority(id: number, p: OgtOrderPriority) {
    setBusy(true);
    try {
      await window.ogt.orders.setPriority(id, p);
      board.patchOrder(id, { priority: p, updatedAt: Date.now() });
    } catch (err) {
      board.notify("تعذر تغيير الأولوية", err instanceof Error ? err.message : "خطأ غير متوقع", "error");
    } finally {
      setBusy(false);
    }
  }

  async function togglePayment(id: number) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const target = o.paymentStatus === "paid" ? "unpaid" : "paid";
    setBusy(true);
    try {
      await window.ogt.orders.setPayment(id, target);
      board.patchOrder(id, { paymentStatus: target, paidAt: target === "paid" ? Date.now() : null, updatedAt: Date.now() });
    } catch (err) {
      board.notify("تعذر تغيير حالة الدفع", err instanceof Error ? err.message : "خطأ غير متوقع", "error");
    } finally {
      setBusy(false);
    }
  }

  function openOrder(id: number) {
    if (suppressClickRef.current) return;
    setSelectedId(id);
    setDetail(null);
    void window.ogt.orders.detail(id).then((d) => {
      if (d) setDetail(d);
    });
  }

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-foreground">
            <ClipboardList className="size-6 text-accent" />
            لوحة الطلبات
          </h1>
          <p className="text-xs font-bold text-muted">
            {orders.length} طلب · {lateCount} متأخر
            {lateCount > 0 && <span className="ms-1 inline-flex items-center gap-1 text-red-600"><AlertTriangle className="size-3" />أسحب البطاقة بين المراحل</span>}
            {lastUpdated && <span className="ms-2">آخر تحديث {formatTime(lastUpdated)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={board.toggleSound}
            title={board.soundOn ? "إيقاف التنبيه الصوتي" : "تشغيل التنبيه الصوتي"}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
              board.soundOn
                ? "border-accent/30 bg-accent/10 text-accent-strong"
                : "border-line bg-surface text-muted hover:bg-card-2"
            }`}
          >
            {board.soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
          <button
            onClick={() => void board.refresh()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-card-2 hover:text-foreground"
            title="تحديث"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {(["new", "preparing", "delivered", "completed"] as OgtOrderStatus[]).map((s) => {
          const Icon = COLUMN_ICON[s];
          return (
            <div key={s} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-soft">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-card-2 text-accent-strong">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-muted">{STATUS_LABELS[s]}</p>
                <p className="text-base font-black leading-tight text-foreground tabular-nums">
                  {grouped[s].length}
                </p>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 shadow-soft">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-red-600">
            <AlertTriangle className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-red-600">متأخرة</p>
            <p className="text-base font-black leading-tight text-red-700 tabular-nums">{lateCount}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-soft">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الطلب، اسم الزبون، الهاتف، الطبق…"
            className="h-9 w-full rounded-xl border border-transparent bg-card-2/60 ps-9 pe-3 text-sm font-semibold outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as PriorityFilter)}
          className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs font-bold text-foreground outline-none transition-colors focus:border-accent"
        >
          <option value="all">كل الأولويات</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          value={payment}
          onChange={(e) => setPayment(e.target.value as PaymentFilter)}
          className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs font-bold text-foreground outline-none transition-colors focus:border-accent"
        >
          <option value="all">كل حالات الدفع</option>
          <option value="unpaid">غير مدفوع</option>
          <option value="paid">مدفوع</option>
        </select>
        <select
          value={date}
          onChange={(e) => setDate(e.target.value as DateFilter)}
          className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs font-bold text-foreground outline-none transition-colors focus:border-accent"
        >
          <option value="all">كل الفترات</option>
          <option value="today">اليوم</option>
          <option value="7d">آخر 7 أيام</option>
        </select>
        {actorOptions.length > 0 && (
          <select
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs font-bold text-foreground outline-none transition-colors focus:border-accent"
          >
            <option value="all">كل المعالجين</option>
            {actorOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => setLateOnly((v) => !v)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors ${
            lateOnly
              ? "bg-red-100 text-red-700"
              : "border border-line bg-surface text-muted hover:bg-card-2 hover:text-foreground"
          }`}
        >
          <AlertTriangle className="size-3.5" />
          متأخرة فقط
        </button>
        {(search || priority !== "all" || payment !== "all" || date !== "all" || actor !== "all" || lateOnly) && (
          <button
            onClick={() => {
              setSearch("");
              setPriority("all");
              setPayment("all");
              setDate("all");
              setActor("all");
              setLateOnly(false);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground"
          >
            <Filter className="size-3.5" />
            مسح الفلاتر
          </button>
        )}
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm font-bold text-muted">
          جاري تحميل الطلبات...
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveOrder(null)}
        >
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-1">
            {STAGE_COLUMNS.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                orders={grouped[status]}
                thresholds={thresholds}
                onOpen={openOrder}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 200 }} style={{ cursor: "grabbing" }}>
            {activeOrder ? (
              <div className="w-72 rotate-3 opacity-95">
                <OrderCardBody order={activeOrder} thresholds={thresholds} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" />
          اسحب البطاقة بين الأعمدة لنقل الطلب · {user.fullName}
        </span>
      </div>

      {detail && selectedId != null && (
        <div className="absolute inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelectedId(null)} />
          <div className="relative z-10 h-full w-full max-w-md rounded-s-2xl border border-line bg-background shadow-card">
            <OrderDetailPanel
              detail={detail}
              thresholds={thresholds}
              products={products}
              canManage={canManage}
              busy={busy}
              cashboxTx={cashboxTx ?? undefined}
              onOpenCashbox={onOpenCashbox}
              onClose={() => setSelectedId(null)}
              onAdvance={(id, to) => void advance(id, to)}
              onCancel={setCancelTarget}
              onPriority={(id, p) => void changePriority(id, p)}
              onTogglePayment={(id) => void togglePayment(id)}
              onToast={(msg) => board.notify(msg)}
            />
          </div>
        </div>
      )}

      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          busy={busy}
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) => void confirmCancel(reason)}
        />
      )}
    </div>
  );
}
