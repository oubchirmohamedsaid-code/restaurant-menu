"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface NewOrderData {
  id: number;
  totalCents: number;
  createdAt: number;
}

function playChime() {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextCtor();
    const tone = (freq: number, delay: number, duration = 0.35) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.05);
    };
    tone(880, 0);
    tone(1174.66, 0.28);
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // audio unsupported: silently skip
  }
}

export default function OrderAlert() {
  const router = useRouter();
  const [notice, setNotice] = useState<NewOrderData | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    const connect = () => {
      es = new EventSource("/admin/orders/events");
      es.addEventListener("new_order", (raw) => {
        try {
          const data = JSON.parse((raw as MessageEvent).data) as NewOrderData;
          playChime();
          setNotice(data);
          router.refresh();
        } catch {
          // malformed payload: ignore
        }
      });
      es.onerror = () => {
        es?.close();
        if (!closed) setTimeout(connect, 5000);
      };
    };
    connect();
    const autoDismiss = window.setInterval(() => setNotice(null), 7000);
    return () => {
      closed = true;
      es?.close();
      window.clearInterval(autoDismiss);
    };
  }, [router]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4 print:hidden">
      {notice && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-xl">
          <span className="text-xl">🛎️</span>
          <span>طلب جديد #{notice.id}</span>
          <button
            onClick={() => setNotice(null)}
            className="rounded-full bg-black/20 px-2 py-0.5 text-xs hover:bg-black/30"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
