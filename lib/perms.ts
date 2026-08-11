import type { UserRole } from "./roles";

export type SectionKey =
  | "orders"
  | "cashbox"
  | "menu"
  | "stock"
  | "stats"
  | "expenses"
  | "suppliers"
  | "settings";

export const SECTIONS: SectionKey[] = [
  "orders",
  "cashbox",
  "menu",
  "stock",
  "stats",
  "expenses",
  "suppliers",
  "settings",
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  orders: "الطلبات",
  cashbox: "صندوق النقود",
  menu: "المينيو",
  stock: "الستوك",
  stats: "الإحصائيات",
  expenses: "النفقات",
  suppliers: "الموردون",
  settings: "الإعدادات",
};

export interface RolePermissions {
  sections: SectionKey[];
  canManageUsers: boolean;
}

const ALL_SECTIONS: SectionKey[] = [...SECTIONS];

const MATRIX: Record<UserRole, RolePermissions> = {
  OWNER: { sections: ALL_SECTIONS, canManageUsers: true },
  ADMIN: { sections: ALL_SECTIONS, canManageUsers: false },
  EMPLOYEE: { sections: ["orders", "cashbox", "stock"], canManageUsers: false },
};

export function permissionsFor(role: UserRole): RolePermissions {
  return MATRIX[role] ?? MATRIX.EMPLOYEE;
}

export function roleCanAccess(role: UserRole, section: SectionKey): boolean {
  return permissionsFor(role).sections.includes(section);
}

export function canManageOrders(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageCashbox(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageMenu(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageStock(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}
