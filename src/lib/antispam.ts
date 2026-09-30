import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";

/**
 * Ochrona formularza rezerwacji.
 *
 * Zgłoszenie od razu blokuje slot w kalendarzu, więc bot albo znudzony nastolatek
 * mogą zapchać warsztatowi cały tydzień. Zamiast captchy (która wymaga konta u
 * zewnętrznego dostawcy i psuje konwersję) stawiamy trzy tanie bariery:
 *
 *  1. pułapka — pole ukryte przed człowiekiem, które boty wypełniają odruchowo,
 *  2. podpisany znacznik czasu — formularz wysłany w ułamku sekundy to nie człowiek,
 *  3. limity ilościowe po numerze telefonu i po skrócie adresu IP.
 *
 * Żadna z nich nie jest szczelna z osobna; razem podnoszą koszt ataku na tyle,
 * że przestaje się opłacać przy tej skali. Przy pierwszym realnym nadużyciu
 * warto dołożyć weryfikację numeru SMS-em.
 */

const SECRET = process.env.APP_SECRET || "niebezpieczny-domyslny-sekret-tylko-do-dev";

export { HONEYPOT_FIELD } from "./form-fields";

/** Minimalny i maksymalny czas między wyświetleniem a wysłaniem formularza. */
const MIN_FILL_MS = 3_000;
const MAX_FILL_MS = 3 * 60 * 60 * 1000;

/** Limity ilościowe. */
export const LIMITS = {
  activePerPhone: 3, // otwarte zgłoszenia jednego numeru w jednym warsztacie
  perIpPerWorkshopDay: 5,
  perIpGlobalDay: 20,
};

/* ---------- adres IP ---------- */

/** Wyciąga adres klienta z nagłówków proxy (Vercel ustawia x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Adresu IP nie zapisujemy — trzymamy tylko jego skrót z sekretem aplikacji.
 * Wystarczy do limitowania, a w bazie nie leży dana osobowa, której nikt nie potrzebuje.
 */
export function hashIp(ip: string): string {
  return createHmac("sha256", SECRET).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

/* ---------- token formularza ---------- */

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(`form:${value}`).digest("hex").slice(0, 32);
}

/** Wywoływane przy renderowaniu strony rezerwacji. */
export function issueFormToken(now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts)}`;
}

export function verifyFormToken(
  token: string,
  now = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  const [ts, mac] = (token || "").split(".");
  if (!ts || !mac) return { ok: false, reason: "Odśwież stronę i spróbuj ponownie." };

  const expected = sign(ts);
  if (mac.length !== expected.length) return { ok: false, reason: "Odśwież stronę i spróbuj ponownie." };
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
    return { ok: false, reason: "Odśwież stronę i spróbuj ponownie." };
  }

  const age = now - Number(ts);
  if (!Number.isFinite(age)) return { ok: false, reason: "Odśwież stronę i spróbuj ponownie." };
  if (age < MIN_FILL_MS) return { ok: false, reason: "Formularz wysłany zbyt szybko." };
  if (age > MAX_FILL_MS) {
    return { ok: false, reason: "Formularz był otwarty zbyt długo. Odśwież stronę." };
  }

  return { ok: true };
}

/* ---------- limity ---------- */

export type LimitResult = { ok: true } | { ok: false; reason: string };

export async function checkRateLimits(opts: {
  workshopId: string;
  phone: string;
  ipHash: string;
  now: Date;
}): Promise<LimitResult> {
  const dayAgo = new Date(opts.now.getTime() - 24 * 3_600_000);

  const activeForPhone = await db.booking.count({
    where: {
      workshopId: opts.workshopId,
      customerPhone: opts.phone,
      status: { in: ["PENDING", "PROPOSED", "CONFIRMED"] },
      endAt: { gte: opts.now },
    },
  });
  if (activeForPhone >= LIMITS.activePerPhone) {
    return {
      ok: false,
      reason:
        "Ten numer ma już maksymalną liczbę otwartych zgłoszeń w tym warsztacie. " +
        "Odwołaj któreś albo zadzwoń do warsztatu.",
    };
  }

  const fromIpHere = await db.booking.count({
    where: { workshopId: opts.workshopId, ipHash: opts.ipHash, createdAt: { gte: dayAgo } },
  });
  if (fromIpHere >= LIMITS.perIpPerWorkshopDay) {
    return { ok: false, reason: "Zbyt wiele zgłoszeń z tego urządzenia. Spróbuj jutro." };
  }

  const fromIpAnywhere = await db.booking.count({
    where: { ipHash: opts.ipHash, createdAt: { gte: dayAgo } },
  });
  if (fromIpAnywhere >= LIMITS.perIpGlobalDay) {
    return { ok: false, reason: "Zbyt wiele zgłoszeń z tego urządzenia. Spróbuj jutro." };
  }

  return { ok: true };
}

/** Prosta heurystyka: boty prawie zawsze wklejają link w pole tekstowe. */
export function looksLikeSpam(text: string): boolean {
  return /https?:\/\/|www\.|\[url=|<a\s/i.test(text);
}
