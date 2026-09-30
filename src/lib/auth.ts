import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

const COOKIE = "warsztat_session";
const SECRET = process.env.APP_SECRET || "niebezpieczny-domyslny-sekret-tylko-do-dev";

/* ---------- hasła ---------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/* ---------- sesja ---------- */

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export async function createSession(workshopId: string) {
  const store = await cookies();
  store.set(COOKIE, `${workshopId}.${sign(workshopId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Zwraca id zalogowanego warsztatu albo null. */
export async function getSessionWorkshopId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const idx = raw.lastIndexOf(".");
  if (idx < 1) return null;
  const id = raw.slice(0, idx);
  const mac = raw.slice(idx + 1);
  const expected = sign(id);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return id;
}

/** Pobiera zalogowany warsztat lub null. */
export async function getCurrentWorkshop() {
  const id = await getSessionWorkshopId();
  if (!id) return null;
  return db.workshop.findUnique({ where: { id } });
}

/** Jak wyżej, ale rzuca - do użycia w akcjach serwerowych panelu. */
export async function requireWorkshop() {
  const workshop = await getCurrentWorkshop();
  if (!workshop) throw new Error("Brak dostępu - zaloguj się ponownie.");
  return workshop;
}

/** Do użycia na stronach panelu - przekierowuje na logowanie zamiast rzucać. */
export async function requireWorkshopOrRedirect() {
  const workshop = await getCurrentWorkshop();
  if (!workshop) redirect("/panel/login");
  return workshop;
}

export function newToken(): string {
  return randomBytes(18).toString("hex");
}
