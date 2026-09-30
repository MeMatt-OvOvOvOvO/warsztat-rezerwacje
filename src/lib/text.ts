/** Dwuliterowy znaczek w pasku górnym, np. „Auto-Serwis Kowalski” → „AK”. */
export function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Porównanie tekstu na potrzeby wyszukiwarki klientów.
 *
 * Prisma na SQLite nie wspiera `mode: "insensitive"`, więc filtrowanie po
 * stronie bazy rozróżniałoby „Nowak” i „nowak”. Filtrujemy w pamięci — lista
 * rezerwacji warsztatu i tak jest w całości wczytywana do grupowania po
 * numerze telefonu, więc nic nas to nie kosztuje. Przy okazji zdejmujemy
 * polskie ogonki: „Zielinski” znajdzie „Zieliński”.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL_CHARS[c] ?? c)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const PL_CHARS: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
};

/** Czy którekolwiek z pól zawiera szukany tekst. Puste zapytanie pasuje do wszystkiego. */
export function matchesQuery(fields: (string | null | undefined)[], query: string): boolean {
  const needle = normalize(query.trim());
  if (!needle) return true;
  return fields.some((f) => (f ? normalize(f).includes(needle) : false));
}
