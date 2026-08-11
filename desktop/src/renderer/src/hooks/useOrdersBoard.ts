import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OgtLateThresholds,
  OgtOrderSummary,
} from "@shared/types";
import { DEFAULT_LATE_MINUTES } from "@lib/orders";
import { formatMoney } from "../format";
import { playChime } from "../lib/sound";

export interface OgtToast {
  id: number;
  orderId?: number;
  title: string;
  body?: string;
  tone: "new" | "error";
}

export interface OrdersBoard {
  orders: OgtOrderSummary[];
  thresholds: OgtLateThresholds;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  newCount: number;
  soundOn: boolean;
  toasts: OgtToast[];
  toggleSound(): void;
  refresh(): Promise<void>;
  patchOrder(id: number, patch: Partial<OgtOrderSummary>): void;
  dismissToast(id: number): void;
  notify(title: string, body?: string, tone?: "new" | "error"): void;
}

const SOUND_KEY = "ogt_sound_on";
const POLL_MS = 6000;
const SOUND_THROTTLE_MS = 8000;

let toastSeq = 0;

export function useOrdersBoard(): OrdersBoard {
  const [orders, setOrders] = useState<OgtOrderSummary[]>([]);
  const [thresholds, setThresholds] = useState<OgtLateThresholds>({ ...DEFAULT_LATE_MINUTES });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [toasts, setToasts] = useState<OgtToast[]>([]);

  const soundOnRef = useRef(soundOn);
  const lastSoundRef = useRef(0);
  const lastMaxIdRef = useRef<number | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<OgtToast, "id">) => {
      const id = ++toastSeq;
      setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), 5000);
    },
    [dismissToast],
  );

  const refresh = useCallback(async () => {
    try {
      const [list, th] = await Promise.all([
        window.ogt.orders.list(),
        window.ogt.orders.thresholds(),
      ]);
      const maxId = list.reduce((m, o) => Math.max(m, o.id), 0);
      const prevMax = lastMaxIdRef.current;
      const arrivals = prevMax !== null ? list.filter((o) => o.id > prevMax) : [];
      lastMaxIdRef.current = Math.max(prevMax ?? 0, maxId);
      setOrders(list);
      setThresholds(th);
      setError(null);
      setLastUpdated(Date.now());
      setLoading(false);
      if (arrivals.length > 0 && prevMax !== null) {
        for (const o of arrivals.slice(0, 5)) {
          pushToast({
            orderId: o.id,
            title: `طلب جديد #${o.id}`,
            body: `${o.customerName || "زبون بدون اسم"} · ${formatMoney(o.totalCents)} دج`,
            tone: "new",
          });
        }
        const now = Date.now();
        if (soundOnRef.current && now - lastSoundRef.current > SOUND_THROTTLE_MS) {
          lastSoundRef.current = now;
          playChime();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل الطلبات");
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      soundOnRef.current = next;
      try {
        localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const patchOrder = useCallback((id: number, patch: Partial<OgtOrderSummary>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  const notify = useCallback(
    (title: string, body?: string, tone: "new" | "error" = "new") => {
      pushToast({ title, body, tone });
    },
    [pushToast],
  );

  return {
    orders,
    thresholds,
    loading,
    error,
    lastUpdated,
    newCount: orders.filter((o) => o.status === "new").length,
    soundOn,
    toasts,
    toggleSound,
    refresh,
    patchOrder,
    dismissToast,
    notify,
  };
}
