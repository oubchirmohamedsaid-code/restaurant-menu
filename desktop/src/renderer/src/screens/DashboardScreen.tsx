import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Receipt,
  Truck,
  Bell,
} from "lucide-react";
import type { SectionKey } from "@lib/perms";
import type { OgtUser } from "@shared/types";
import { Sidebar } from "../components/Sidebar";
import { TitleBar } from "../components/TitleBar";
import { PlaceholderScreen } from "../components/PlaceholderScreen";
import { OrdersSection } from "../sections/OrdersSection";
import { SettingsSection } from "../sections/SettingsSection";
import { CashboxSection } from "../sections/CashboxSection";
import { MenuSection } from "../sections/MenuSection";
import { StockSection } from "../sections/StockSection";
import { useOrdersBoard } from "../hooks/useOrdersBoard";

const PLACEHOLDERS: Record<Exclude<SectionKey, "orders" | "settings" | "cashbox" | "menu" | "stock">, { icon: LucideIcon; desc: string }> = {
  stats: {
    icon: BarChart3,
    desc: "الإحصائيات: تقارير المبيعات والأداء (يُعاد استخدام إحصائيات الموقع الحالية).",
  },
  expenses: {
    icon: Receipt,
    desc: "النفقات: تسجيل المصروفات التشغيلية واليومية.",
  },
  suppliers: {
    icon: Truck,
    desc: "الموردون: إدارة الموردين وطلبات التوريد.",
  },
};

export function DashboardScreen({
  user,
  onLogout,
}: {
  user: OgtUser;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<SectionKey>("orders");
  const [cashboxFocus, setCashboxFocus] = useState<number | null>(null);
  const board = useOrdersBoard();

  function renderSection() {
    if (section === "orders")
      return (
        <OrdersSection
          user={user}
          board={board}
          onOpenCashbox={(txId) => {
            setCashboxFocus(txId);
            setSection("cashbox");
          }}
        />
      );
    if (section === "settings") return <SettingsSection user={user} />;
    if (section === "menu") return <MenuSection user={user} />;
    if (section === "stock") return <StockSection user={user} />;
    if (section === "cashbox")
      return (
        <CashboxSection
          user={user}
          focusTxId={cashboxFocus}
          onClearFocus={() => setCashboxFocus(null)}
        />
      );
    const p = PLACEHOLDERS[section];
    return (
      <PlaceholderScreen
        icon={p.icon}
        title={sectionLabel(section)}
        description={p.desc}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar user={user} section={section} onSelect={setSection} onLogout={onLogout} badge={board.newCount} />
        <main className="min-w-0 flex-1 overflow-y-auto bg-background p-5">{renderSection()}</main>
      </div>
      {board.toasts.length > 0 && (
        <div className="pointer-events-none fixed start-1/2 top-16 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
          {board.toasts.map((t) => (
            <button
              key={t.id}
              onClick={() => board.dismissToast(t.id)}
              className={`pointer-events-auto flex items-start gap-2 rounded-2xl border px-4 py-3 text-start shadow-card ${
                t.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-line bg-surface text-foreground"
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

function sectionLabel(section: SectionKey): string {
  const labels: Record<SectionKey, string> = {
    orders: "الطلبات",
    cashbox: "صندوق النقود",
    menu: "المينيو",
    stock: "الستوك",
    stats: "الإحصائيات",
    expenses: "النفقات",
    suppliers: "الموردون",
    settings: "الإعدادات",
  };
  return labels[section];
}
