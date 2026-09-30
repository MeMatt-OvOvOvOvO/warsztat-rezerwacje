import { wallToUtc } from "./time";

/**
 * Plik .ics z wizytą — „Dodaj do kalendarza” dla Kalendarza Apple,
 * Google Calendar i Outlooka. Format iCalendar (RFC 5545).
 *
 * Dwie rzeczy, na których łatwo się przejechać:
 *
 * 1. Czas. W bazie trzymamy czas ścienny warsztatu, a plik musi zawierać
 *    prawdziwy moment UTC — inaczej latem wizyta wpada do kalendarza dwie
 *    godziny za późno. Konwersję robi wallToUtc().
 * 2. Łamanie linii. Standard każe łamać powyżej 75 oktetów, licząc bajty,
 *    nie znaki — przy polskich ogonkach to różnica. Kalendarz Apple potrafi
 *    odrzucić cały plik, gdy linia jest za długa.
 */

/** Znaki specjalne w treści: przecinek, średnik, ukośnik i nowa linia. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Łamanie linii po 75 oktetach, kontynuacja zaczyna się spacją. */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // nie tniemy w środku znaku wielobajtowego
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // kolejne linie mają wiodącą spację
  }

  return parts.join("\r\n ");
}

/** Data w formacie iCalendar: 20260828T090000Z */
export function icsTimestamp(utc: Date): string {
  return `${utc.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

export type IcsBooking = {
  uid: string;
  /** czas ścienny warsztatu — konwersja do UTC dzieje się tutaj */
  startAt: Date;
  endAt: Date;
  updatedAt: Date;
  serviceName: string;
  workshopName: string;
  workshopPhone: string | null;
  workshopAddress: string | null;
  carModel: string;
  status: string;
  manageUrl: string;
  /** ile godzin przed wizytą ma zadzwonić przypomnienie w kalendarzu */
  alarmHoursBefore: number;
};

export function buildBookingIcs(b: IcsBooking): string {
  const icsStatus =
    b.status === "CONFIRMED" || b.status === "DONE"
      ? "CONFIRMED"
      : b.status === "CANCELLED" || b.status === "REJECTED"
        ? "CANCELLED"
        : "TENTATIVE";

  const description = [
    `Usługa: ${b.serviceName}`,
    `Auto: ${b.carModel}`,
    b.workshopPhone ? `Telefon do warsztatu: ${b.workshopPhone}` : "",
    "",
    `Szczegóły i odwołanie wizyty: ${b.manageUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//System rezerwacji warsztatowych//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.uid}`,
    `DTSTAMP:${icsTimestamp(new Date())}`,
    `DTSTART:${icsTimestamp(wallToUtc(b.startAt))}`,
    `DTEND:${icsTimestamp(wallToUtc(b.endAt))}`,
    // sekwencja rośnie przy każdej edycji, więc kalendarz nadpisze starą wersję
    `SEQUENCE:${Math.floor(b.updatedAt.getTime() / 1000)}`,
    `SUMMARY:${escapeText(`${b.serviceName} — ${b.workshopName}`)}`,
    b.workshopAddress ? `LOCATION:${escapeText(b.workshopAddress)}` : "",
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${escapeText(b.manageUrl)}`,
    `STATUS:${icsStatus}`,
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(`Jutro wizyta: ${b.serviceName}`)}`,
    `TRIGGER:-PT${Math.max(1, Math.round(b.alarmHoursBefore))}H`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  // RFC 5545 wymaga CRLF na końcu każdej linii
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
