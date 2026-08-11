export type UserRole = "OWNER" | "ADMIN" | "EMPLOYEE";

export const USER_ROLES: UserRole[] = ["OWNER", "ADMIN", "EMPLOYEE"];

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "المالك",
  ADMIN: "مدير",
  EMPLOYEE: "موظف",
};
