import { getDb } from "./db";
import type { UserRole } from "./roles";

export type { UserRole } from "./roles";
export { USER_ROLES, ROLE_LABELS } from "./roles";

export interface UserRow {
  id: number;
  fullName: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}

export interface UserPublic {
  id: number;
  fullName: string;
  username: string;
  role: UserRole;
  createdAt: number;
}

export interface CreateUserInput {
  fullName: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  const row = (await db.prepare("SELECT COUNT(*) AS n FROM users").get()) as { n: number };
  return row.n;
}

export async function getUserById(id: number): Promise<UserRow | undefined> {
  const db = await getDb();
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return row ? ({ ...row } as unknown as UserRow) : undefined;
}

export async function getUserByUsername(username: string): Promise<UserRow | undefined> {
  const db = await getDb();
  const row = await db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  return row ? ({ ...row } as unknown as UserRow) : undefined;
}

export async function listUsers(): Promise<UserRow[]> {
  const db = await getDb();
  return (await db.prepare("SELECT * FROM users ORDER BY id").all()) as unknown as UserRow[];
}

export async function createUser(input: CreateUserInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const result = await db
    .prepare(
      "INSERT INTO users (fullName, username, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(input.fullName, input.username, input.passwordHash, input.role, now, now);
  return Number(result.lastInsertRowid);
}

export async function updateUserRole(id: number, role: UserRole): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE users SET role = ?, updatedAt = ? WHERE id = ?")
    .run(role, Date.now(), id);
}

export async function deleteUser(id: number): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function toPublic(u: UserRow): UserPublic {
  return {
    id: u.id,
    fullName: u.fullName,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
  };
}
