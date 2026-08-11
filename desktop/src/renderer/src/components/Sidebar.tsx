import {
  ClipboardList,
  Wallet,
  UtensilsCrossed,
  Package,
  BarChart3,
  Receipt,
  Truck,
  Settings,
  LogOut,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { permissionsFor, SECTION_LABELS } from "@lib/perms";
import type { SectionKey } from "@lib/perms";
import { ROLE_LABELS } from "@lib/roles";
import type { OgtUser } from "@shared/types";

const ICONS: Record<SectionKey, LucideIcon> = {
  orders: ClipboardList,
  cashbox: Wallet,
  menu: UtensilsCrossed,
  stock: Package,
  stats: BarChart3,
  expenses: Receipt,
  suppliers: Truck,
  settings: Settings,
};

export const SECTION_ORDER: SectionKey[] = [
  "orders",
  "cashbox",
  "menu",
  "stock",
  "stats",
  "expenses",
  "suppliers",
  "settings",
];

export function Sidebar({
  user,
  section,
  onSelect,
  onLogout,
  badge,
}: {
  user: OgtUser;
  section: SectionKey;
  onSelect: (s: SectionKey) => void;
  onLogout: () => void;
  badge?: number;
}) {
  const allowed = permissionsFor(user.role).sections;
  const items = SECTION_ORDER.filter((s) => allowed.includes(s));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-e border-line bg-surface">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 font-black text-white shadow-sm">
          O
        </span>
        <div>
          <p className="text-sm font-black text-foreground">OGTX</p>
          <p className="text-[11px] font-bold text-muted">لوحة إدارة المطعم</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {items.map((key) => {
          const Icon = ICONS[key];
          const active = section === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                active
                  ? "bg-accent/15 text-accent-strong"
                  : "text-muted hover:bg-card-2 hover:text-foreground"
              }`}
            >
              <Icon className="size-[18px]" />
              <span className="flex-1 text-start">{SECTION_LABELS[key]}</span>
              {key === "orders" && (badge ?? 0) > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white tabular-nums">
                  {badge! > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-card-2 px-3 py-2.5">
          <UserRound className="size-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{user.fullName}</p>
            <p className="text-[11px] font-bold text-muted">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-bold text-muted transition-colors hover:border-red-300 hover:text-red-600"
        >
          <LogOut className="size-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
