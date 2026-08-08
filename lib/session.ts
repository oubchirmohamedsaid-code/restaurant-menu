import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.SESSION_SECRET ?? "dev-secret";
const TTL_MS = 1000 * 60 * 60 * 12;

function b64u(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function b64d(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && input === expected;
}

export function createSessionToken(): string {
  const payload = b64u(
    JSON.stringify({ sub: "admin", exp: Date.now() + TTL_MS }),
  );
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, "base64url");
  } catch {
    return false;
  }
  let expected: Buffer;
  try {
    expected = Buffer.from(sign(payload), "base64url");
  } catch {
    return false;
  }
  if (sigBuf.length !== expected.length) return false;
  let valid = false;
  try {
    valid = timingSafeEqual(sigBuf, expected);
  } catch {
    return false;
  }
  if (!valid) return false;
  try {
    const { exp } = JSON.parse(b64d(payload)) as { exp: number };
    return exp > Date.now();
  } catch {
    return false;
  }
}
