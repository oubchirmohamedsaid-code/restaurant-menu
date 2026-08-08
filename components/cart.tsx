"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { formatPrice, RESTAURANT_NAME } from "@/lib/utils";
import { cartCount, cartTotalCents } from "@/lib/cart";
import type { CartLine } from "@/lib/cart";
import { placeOrderAction } from "@/app/orders/actions";

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

  const { count, totalCents } = useMemo(
    () => ({ count: cartCount(lines), totalCents: cartTotalCents(lines) }),
    [lines],
  );

  const value: CartCtx = useMemo(
    () => ({ lines, count, totalCents, isOpen, open, close, add, setQty, clear }),
    [lines, count, totalCents, isOpen, open, close, add, setQty, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function SiteHeader() {
  const { count, open } = useCart();
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
              type="button"
              onClick={open}
              aria-label={`فتح السلة، ${count} صنف`}
              className="relative flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-black transition-transform hover:scale-105 active:scale-95"
            >
              <span aria-hidden>🛒</span>
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
