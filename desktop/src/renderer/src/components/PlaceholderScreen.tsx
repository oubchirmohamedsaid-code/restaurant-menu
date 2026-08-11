import type { LucideIcon } from "lucide-react";

export function PlaceholderScreen({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-card-2 text-accent">
          <Icon className="size-8" />
        </div>
        <h2 className="mt-4 text-xl font-black text-foreground">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-muted">{description}</p>
        <span className="mt-4 inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold text-muted">
          قيد التطوير
        </span>
      </div>
    </div>
  );
}
