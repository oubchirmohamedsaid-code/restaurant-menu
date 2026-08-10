"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/admin/actions";

const NAV = [
  { href: "/admin/orders", label: "الطلبات", icon: "🧾" },
  { href: "/admin/stats", label: "الإحصائيات", icon: "📊" },
  { href: "/admin/dashboard", label: "قائمة الطعام", icon: "🍽️" },
  { href: "/admin/settings", label: "الإعدادات", icon: "⚙️" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin") return <>{children}</>;

  const nav = NAV.map((item) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
          active
            ? "bg-accent/15 text-accent-strong"
            : "text-muted hover:bg-surface hover:text-foreground"
        }`}
      >
        <span aria-hidden>{item.icon}</span>
        {item.label}
      </Link>
    );
  });

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="hidden h-dvh w-60 shrink-0 flex-col border-e border-line bg-card p-4 md:flex">
        <p className="mb-6 flex items-center gap-2 px-2 text-lg font-black">
          <span aria-hidden>🍽️</span> الإدارة
        </p>
        <nav className="flex flex-1 flex-col gap-1">{nav}</nav>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm font-bold text-muted transition-colors hover:border-red-500 hover:text-red-400"
          >
            تسجيل الخروج
          </button>
        </form>
      </aside>
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-line bg-card px-3 py-2 md:hidden">
        {nav}
        <form action={logoutAction}>
          <button
            type="submit"
            className="whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold text-muted transition-colors hover:text-red-400"
          >
            خروج
          </button>
        </form>
      </nav>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
