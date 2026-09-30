import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Dostęp operatora systemu (Ciebie), a nie właściciela warsztatu.
 *
 * Jedno hasło w zmiennej środowiskowej ADMIN_PASSWORD i osobne ciasteczko —
 * sesja panelu warsztatu nie daje wstępu tutaj i odwrotnie. Gdy dojdzie druga
 * osoba, wystarczy zamienić to na tabelę Admin bez ruszania widoków.
 */

const COOKIE = "warsztat_admin";
const SECRET = process.env.APP_SECRET || "niebezpieczny-domyslny-sekret-tylko-do-dev";

function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD;
  return value && value.length > 0 ? value : null;
}

/** Czy panel operatora jest w ogóle włączony (jest ustawione hasło). */
export function isAdminConfigured(): boolean {
  return adminPassword() !== null;
}

function equals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = adminPassword();
  if (!expected) return false;
  return equals(candidate, expected);
}

/** Wartość ciasteczka jest związana z hasłem — zmiana hasła unieważnia sesje. */
function sessionValue(): string {
  return createHmac("sha256", SECRET).update(`admin:${adminPassword()}`).digest("hex");
}

export async function createAdminSession() {
  const store = await cookies();
  store.set(COOKIE, sessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function destroyAdminSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function isAdminLoggedIn(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return false;
  return equals(raw, sessionValue());
}

/** Do stron panelu — przekierowuje na logowanie. */
export async function requireAdminOrRedirect() {
  if (!(await isAdminLoggedIn())) redirect("/admin/login");
}

/** Do akcji serwerowych — rzuca, zamiast po cichu wykonać operację. */
export async function requireAdmin() {
  if (!(await isAdminLoggedIn())) {
    throw new Error("Brak dostępu do panelu operatora.");
  }
}
