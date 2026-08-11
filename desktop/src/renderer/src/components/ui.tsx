import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { LoaderCircle, X } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-strong shadow-sm disabled:opacity-50",
  secondary:
    "border border-line bg-surface text-foreground hover:bg-card-2 disabled:opacity-50",
  ghost: "text-muted hover:text-foreground hover:bg-card-2 disabled:opacity-50",
  danger:
    "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className = "",
  loading = false,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${VARIANT[variant]} ${className}`}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function TextField({
  label,
  error,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-sm font-bold text-foreground">{label}</span>
      )}
      <input
        {...rest}
        className={`h-11 w-full rounded-xl border bg-surface px-3 text-sm font-semibold outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20 ${
          error ? "border-red-400" : "border-line"
        }`}
      />
      {error && <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}
    </label>
  );
}

export function SelectField({
  label,
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-sm font-bold text-foreground">{label}</span>
      )}
      <select
        {...rest}
        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-semibold outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} overflow-hidden rounded-2xl border border-line bg-surface shadow-card`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-black text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="app-region-no-drag rounded-lg p-1.5 text-muted transition-colors hover:bg-card-2 hover:text-foreground"
            aria-label="إغلاق"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-muted">
      <LoaderCircle className="size-7 animate-spin text-accent" />
      {label && <p className="text-sm font-bold">{label}</p>}
    </div>
  );
}
