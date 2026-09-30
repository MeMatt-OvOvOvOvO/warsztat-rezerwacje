/**
 * Obsługa czasu w aplikacji.
 *
 * Zasada: wszystkie daty w bazie to "czas ścienny" warsztatu zapisany w polach UTC.
 * Nigdy nie konwertujemy stref przy odczycie - godzina 10:00 zapisana w bazie
 * to zawsze 10:00 dla warsztatu i dla klienta, niezależnie od tego, gdzie stoi serwer.
 *
 * Jedyne miejsce, w którym strefa ma znaczenie, to ustalenie "teraz" - do tego
 * służy nowWall(), która pyta o aktualny czas w strefie warsztatu.
 */

export const WORKSHOP_TZ = "Europe/Warsaw";

const DAY_NAMES = [
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
];

const DAY_SHORT = ["pon", "wt", "śr", "czw", "pt", "sob", "niedz"];

const MONTHS = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

/** Aktualny czas ścienny w strefie warsztatu, zapisany jako Date w polach UTC. */
export function nowWall(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WORKSHOP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")),
  );
}

/** Przesunięcie strefy warsztatu (w milisekundach) w danym momencie rzeczywistym. */
function tzOffsetAt(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WORKSHOP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asIfUtc - instant.getTime();
}

/**
 * Zamienia czas ścienny warsztatu na prawdziwy moment UTC.
 *
 * Potrzebne wszędzie tam, gdzie czas opuszcza aplikację i musi być zrozumiały
 * dla świata zewnętrznego — przede wszystkim w pliku kalendarza (.ics). Bez tej
 * konwersji wizyta o 10:00 wpadłaby klientowi do kalendarza o 12:00 latem.
 *
 * Dwa przejścia, bo pierwsze przybliżenie może trafić w inną stronę zmiany czasu.
 */
export function wallToUtc(wall: Date): Date {
  const first = new Date(wall.getTime() - tzOffsetAt(wall));
  return new Date(wall.getTime() - tzOffsetAt(first));
}

/** "YYYY-MM-DD" dla danej daty. */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Buduje Date z klucza dnia i liczby minut od północy. */
export function wallDate(key: string, minutes = 0): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + minutes * 60_000);
}

/** Minuty od północy dla danej daty. */
export function minutesOf(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** 0 = poniedziałek ... 6 = niedziela */
export function weekdayOf(d: Date | string): number {
  const date = typeof d === "string" ? wallDate(d) : d;
  return (date.getUTCDay() + 6) % 7;
}

export function addDays(key: string, n: number): string {
  return dateKey(new Date(wallDate(key).getTime() + n * 86_400_000));
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}

/** "08:30" */
export function fmtTime(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/** 510 -> "08:30" */
export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "08:30" -> 510 */
export function parseMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** "18 sierpnia 2026" */
export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? wallDate(d) : d;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "wtorek, 18 sierpnia 2026" */
export function fmtDateLong(d: Date | string): string {
  const date = typeof d === "string" ? wallDate(d) : d;
  return `${DAY_NAMES[weekdayOf(date)]}, ${fmtDate(date)}`;
}

/** "wt, 18.08" */
export function fmtDateShort(d: Date | string): string {
  const date = typeof d === "string" ? wallDate(d) : d;
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${DAY_SHORT[weekdayOf(date)]}, ${dd}.${mm}`;
}

/** "wtorek, 18 sierpnia 2026, 10:30" */
export function fmtDateTime(d: Date): string {
  return `${fmtDateLong(d)}, ${fmtTime(d)}`;
}

export function dayName(weekday: number): string {
  return DAY_NAMES[weekday];
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
