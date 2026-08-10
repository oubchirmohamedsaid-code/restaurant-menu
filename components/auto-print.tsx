"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-accent px-5 py-2 text-sm font-extrabold text-black"
    >
      طباعة
    </button>
  );
}
