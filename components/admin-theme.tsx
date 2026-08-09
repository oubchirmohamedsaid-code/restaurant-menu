"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function AdminTheme() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.toggle("admin-light", pathname.startsWith("/admin"));
  }, [pathname]);

  return null;
}
