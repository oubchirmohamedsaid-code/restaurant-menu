"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { formatPrice, RESTAURANT_NAME } from "@/lib/utils";
import {
  cartCount,
  cartTotalCents,
  flyVector,
  FLY_TARGET_OPACITY,
  FLY_TARGET_SCALE,
  FLY_PREP_SCALE,
  FLY_PREP_TRANSITION,
  FLY_LAUNCH_TRANSITION,
} from "@/lib/cart";
import type { CartLine, Rect } from "@/lib/cart";
import { placeOrderAction } from "@/app/orders/actions";

interface Flight {
  id: number;
  from: Rect;
  to: Rect;
  imageUrl: string;
  name: string;
}

interface CartToast {
  id: number;
  name: string;
}

interface CartCtx {
  lines: CartLine[];
  count: number;
  totalCents: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (p: Omit<CartLine, "qty">) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  flyToCart: (from: Rect, imageUrl: string, name: string) => void;
  cartButtonRef: RefObject<HTMLButtonElement | null>;
  bumpNonce: number;
}

const CartContext = createContext<CartCtx | null>(null);

const KEY = "menu_cart_v2";

export function useCart(): CartCtx {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [toasts, setToasts] = useState<CartToast[]>([]);
  const [bumpNonce, setBumpNonce] = useState(0);
  const cartButtonRef = useRef<HTMLButtonElement | null>(null);
  const flightSeq = useRef(0);
  const toastSeq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CartLine[];
          if (Array.isArray(parsed)) setLines(parsed.filter((l) => l && l.qty > 0));
        }
      } catch {
        setLines([]);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable — non-blocking */
    }
  }, [lines]);

  const add = useCallback((p: Omit<CartLine, "qty">) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.key === p.key);
      if (existing) {
        return prev.map((l) => (l.key === p.key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { ...p, qty: 1 }];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) => (l.key === key ? { ...l, qty } : l)),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const pushToast = useCallback((name: string) => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev, { id, name }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  const completeFlight = useCallback(
    (flight: Flight) => {
      setFlights((prev) => prev.filter((f) => f.id !== flight.id));
      setBumpNonce((n) => n + 1);
      pushToast(flight.name);
    },
    [pushToast],
  );

  const flyToCart = useCallback(
    (from: Rect, imageUrl: string, name: string) => {
      const btn = cartButtonRef.current;
      const to = btn ? btn.getBoundingClientRect() : null;
      if (!to || from.width <= 0 || from.height <= 0) {
        setBumpNonce((n) => n + 1);
        pushToast(name);
        return;
      }
      setFlights((prev) => [
        ...prev,
        { id: ++flightSeq.current, from, to, imageUrl, name },
      ]);
    },
    [pushToast],
  );

  const { count, totalCents } = useMemo(
    () => ({ count: cartCount(lines), totalCents: cartTotalCents(lines) }),
    [lines],
  );

  const value: CartCtx = useMemo(
    () => ({
      lines,
      count,
      totalCents,
      isOpen,
      open,
      close,
      add,
      setQty,
      clear,
      flyToCart,
      cartButtonRef,
      bumpNonce,
    }),
    [
      lines,
      count,
      totalCents,
      isOpen,
      open,
      close,
      add,
      setQty,
      clear,
      flyToCart,
      cartButtonRef,
      bumpNonce,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartToasts toasts={toasts} />
      {flights.map((flight) => (
        <FlyingImage key={flight.id} flight={flight} onDone={completeFlight} />
      ))}
    </CartContext.Provider>
  );
}

function FlyingImage({
  flight,
  onDone,
}: {
  flight: Flight;
  onDone: (flight: Flight) => void;
}) {
  const { dx, dy } = flyVector(flight.from, flight.to);
  const [launched, setLaunched] = useState(false);
  return (
    <motion.div
      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      animate={{
        x: launched ? dx : 0,
        y: launched ? dy : 0,
        scale: launched ? FLY_TARGET_SCALE : FLY_PREP_SCALE,
        opacity: FLY_TARGET_OPACITY,
      }}
      transition={launched ? FLY_LAUNCH_TRANSITION : FLY_PREP_TRANSITION}
      onAnimationComplete={() => {
        if (launched) onDone(flight);
        else setLaunched(true);
      }}
      className="pointer-events-none fixed left-0 top-0 z-[70] overflow-hidden rounded-2xl border-2 border-black shadow-2xl"
      style={{
        left: flight.from.x,
        top: flight.from.y,
        width: flight.from.width,
        height: flight.from.height,
      }}
    >
      <Image
        src={flight.imageUrl}
        alt=""
        fill
        unoptimized
        sizes="200px"
        className="object-cover"
      />
    </motion.div>
  );
}

function CartToasts({ toasts }: { toasts: CartToast[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[80] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            role="status"
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-extrabold shadow-2xl"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-black text-white">
              ✓
            </span>
            <span>
              أُضيف <span className="text-accent-strong">{t.name}</span> إلى السلة
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function SiteHeader() {
  const { count, open, cartButtonRef, bumpNonce } = useCart();
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold">
          <span aria-hidden className="text-2xl">🍽️</span>
          <span>{RESTAURANT_NAME}</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/menu"
            className="rounded-full px-4 py-2 text-sm font-bold text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            المنيو
          </Link>
          <Link
            href="/admin"
            aria-label="لوحة التحكم"
            title="لوحة التحكم"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <span aria-hidden>🔒</span>
          </Link>
          {!isAdmin && (
            <button
              ref={cartButtonRef}
              type="button"
              onClick={open}
              aria-label={`فتح السلة، ${count} صنف`}
              className="relative flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-black transition-transform hover:scale-105 active:scale-95"
            >
              <motion.span
                key={bumpNonce}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.35, 1] }}
                transition={{ duration: 0.45, times: [0, 0.5, 1] }}
                className="inline-block"
                aria-hidden
              >
                🛒
              </motion.span>
              <span className="hidden sm:inline">السلة</span>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className="absolute -left-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-black text-white"
                >
                  {count}
                </motion.span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function CartDrawer() {
  const { isOpen, close, lines, setQty, clear, totalCents } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [placedId, setPlacedId] = useState<number | null>(null);
  const [orderError, setOrderError] = useState<string | undefined>();

  const handleClose = () => {
    close();
    setPlacedId(null);
    setOrderError(undefined);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setOrderError(undefined);
    const res = await placeOrderAction(lines);
    setSubmitting(false);
    if (res.ok && res.orderId !== undefined) {
      setPlacedId(res.orderId);
      clear();
    } else {
      setOrderError(res.error ?? "تعذر إرسال الطلب، حاول مجدداً");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 left-0 z-50 flex w-full max-w-md flex-col border-r border-line bg-surface shadow-2xl"
            role="dialog"
            aria-label="سلة الطلبات"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-lg font-extrabold">🛒 سلة الطلبات</h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="إغلاق السلة"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-muted transition-colors hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {placedId !== null ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <span className="text-6xl" aria-hidden>✅</span>
                  <p className="text-lg font-black">تم استلام طلبك</p>
                  <p className="text-sm text-muted">
                    رقم الطلب: <span className="font-black text-accent">#{placedId}</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="mt-2 rounded-full bg-accent px-6 py-2.5 font-extrabold text-black transition-transform hover:brightness-110 active:scale-95"
                  >
                    حسناً
                  </button>
                </div>
              ) : lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted">
                  <span className="text-6xl" aria-hidden>🧺</span>
                  <p className="font-bold">سلتك فارغة</p>
                  <p className="text-sm">تصفح المنيو وأضف ما تشتهي</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {lines.map((l) => (
                    <li
                      key={l.key}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
                    >
                      <Image
                        src={l.imageUrl}
                        alt={l.name}
                        width={64}
                        height={64}
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{l.name}</p>
                        {(l.removed.length > 0 || l.extras.length > 0) && (
                          <p className="mt-0.5 text-xs leading-relaxed text-muted">
                            {l.removed.length > 0 && (
                              <span>بدون: {l.removed.map((r) => r.name).join("، ")}</span>
                            )}
                            {l.removed.length > 0 && l.extras.length > 0 && " · "}
                            {l.extras.length > 0 && (
                              <span>+ {l.extras.map((e) => e.name).join("، ")}</span>
                            )}
                          </p>
                        )}
                        <p className="text-sm text-accent">
                          {formatPrice(l.priceCents * l.qty)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQty(l.key, l.qty - 1)}
                          aria-label={`إنقاص ${l.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-card-2 text-lg font-black transition-colors hover:text-accent"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-extrabold">{l.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(l.key, l.qty + 1)}
                          aria-label={`زيادة ${l.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-card-2 text-lg font-black transition-colors hover:text-accent"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <div className="border-t border-line px-5 py-4">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-muted">الإجمالي</span>
                  <span className="text-xl font-black text-accent">
                    {formatPrice(totalCents)}
                  </span>
                </div>
                {orderError && (
                  <p className="mb-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-400">
                    {orderError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 font-extrabold text-black transition-transform hover:brightness-110 active:scale-95 disabled:opacity-60"
                  >
                    {submitting ? "جارٍ الإرسال…" : "تأكيد الطلب"}
                  </button>
                  <button
                    type="button"
                    onClick={clear}
                    className="rounded-full border border-line px-4 py-3 text-sm font-bold text-muted transition-colors hover:text-red-400"
                  >
                    إفراغ
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
