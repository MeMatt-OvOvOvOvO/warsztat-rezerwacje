/**
 * Numery telefonu wpisujemy po polsku („601 234 567”), a bramka SMS wymaga
 * formatu międzynarodowego E.164 („+48601234567”). Tłumaczenie siedzi tutaj.
 */

const PL_PREFIX = "+48";

/** Zwraca numer w formacie E.164 albo null, jeśli nie da się go sensownie odczytać. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // już międzynarodowy
  if (hasPlus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  // 0048601234567 albo 48601234567
  if (digits.startsWith("0048")) {
    const rest = digits.slice(4);
    return rest.length === 9 ? `${PL_PREFIX}${rest}` : null;
  }
  if (digits.length === 11 && digits.startsWith("48")) {
    return `+${digits}`;
  }

  // 0601234567 — stary zapis z zerem kierunkowym
  if (digits.length === 10 && digits.startsWith("0")) {
    return `${PL_PREFIX}${digits.slice(1)}`;
  }

  // zwykłe polskie dziewięć cyfr
  if (digits.length === 9) {
    return `${PL_PREFIX}${digits}`;
  }

  return null;
}

/** Czy numer wygląda na komórkowy — na stacjonarny SMS nie dojdzie. */
export function looksMobile(e164: string | null): boolean {
  if (!e164) return false;
  if (!e164.startsWith(PL_PREFIX)) return true; // zagraniczne zostawiamy bramce
  const national = e164.slice(PL_PREFIX.length);
  // polskie komórki zaczynają się od 45, 5, 6, 7 lub 8 (88 to też komórka)
  return /^(45|5|6|7|8)/.test(national);
}
