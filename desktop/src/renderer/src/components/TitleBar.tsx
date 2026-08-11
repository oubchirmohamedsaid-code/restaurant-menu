import { Minus, Square, X } from "lucide-react";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-xl";
  const text = size === "sm" ? "text-sm" : "text-lg";
  return (
    <span
      className={`${box} ${text} flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600 font-black text-white shadow-sm`}
    >
      O
    </span>
  );
}

export function TitleBar() {
  return (
    <header className="app-region-drag flex h-10 shrink-0 items-center justify-between border-b border-line bg-surface px-3">
      <div className="flex items-center gap-2 px-1">
        <BrandMark size="sm" />
        <span className="text-sm font-black tracking-wide text-foreground">OGTX</span>
        <span className="text-[11px] font-bold text-muted">لوحة إدارة المطعم</span>
      </div>
      <div className="app-region-no-drag flex items-center gap-1">
        <button
          onClick={() => window.ogt.window.minimize()}
          className="flex h-7 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-card-2 hover:text-foreground"
          aria-label="تصغير"
        >
          <Minus className="size-4" />
        </button>
        <button
          onClick={() => window.ogt.window.toggleMaximize()}
          className="flex h-7 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-card-2 hover:text-foreground"
          aria-label="تكبير"
        >
          <Square className="size-3" />
        </button>
        <button
          onClick={() => window.ogt.window.close()}
          className="flex h-7 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-red-600 hover:text-white"
          aria-label="إغلاق"
        >
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
}
