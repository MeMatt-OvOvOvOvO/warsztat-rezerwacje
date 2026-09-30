import { randomInt } from "node:crypto";

/** Punkt startowy dla nowo zakładanego warsztatu — właściciel poprawia to u siebie w ustawieniach. */

export const DEFAULT_SERVICES = [
  {
    name: "Wymiana klocków hamulcowych",
    description: "Jedna oś, klocki klienta lub nasze",
    durationMin: 90,
    priceFrom: 150,
  },
  {
    name: "Wymiana opon",
    description: "Komplet 4 kół, wyważanie w cenie",
    durationMin: 60,
    priceFrom: 160,
  },
  {
    name: "Wymiana oleju i filtrów",
    description: "Olej, filtr oleju, filtr powietrza",
    durationMin: 60,
    priceFrom: 120,
  },
  {
    name: "Przegląd okresowy",
    description: "Kontrola zawieszenia, hamulców, płynów",
    durationMin: 120,
    priceFrom: 250,
  },
  {
    name: "Diagnostyka komputerowa",
    description: "Odczyt błędów i konsultacja",
    durationMin: 45,
    priceFrom: 100,
  },
];

/** pon–pt 8:00–17:00, sob 9:00–13:00, niedziela nieczynne */
export function defaultWorkingHours() {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    openMin: weekday === 5 ? 9 * 60 : 8 * 60,
    closeMin: weekday === 5 ? 13 * 60 : 17 * 60,
    isClosed: weekday === 6,
  }));
}

const PL_CHARS: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

/** „Auto-Serwis Kowalski” → „auto-serwis-kowalski” */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL_CHARS[c] ?? c)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Losowe hasło startowe dla właściciela. Alfabet bez „l”, „o” i zer,
 * żeby dało się je bez pomyłki podyktować przez telefon.
 */
export function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[randomInt(alphabet.length)];
    if (i === 4) out += "-";
  }
  return out;
}
