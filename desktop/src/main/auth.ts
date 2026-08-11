import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Role } from "../shared/types";

export interface SessionUser {
  id: number;
  fullName: string;
  username: string;
  role: Role;
  createdAt: number;
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, nRaw, rRaw, pRaw, saltB64, hashB64] = stored.split(":");
    if (algo !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(nRaw),
      r: Number(rRaw),
      p: Number(pRaw),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

let current: SessionUser | null = null;

export function setSession(user: SessionUser | null): void {
  current = user;
}

export function getSession(): SessionUser | null {
  return current;
}
