/** Testy czystej logiki - działają bez bazy danych. Uruchomienie: npm test */
import assert from "node:assert/strict";
import {
  addDays,
  addMinutes,
  dateKey,
  fmtDateLong,
  fmtDateShort,
  fmtDuration,
  fmtMinutes,
  fmtTime,
  minutesOf,
  nowWall,
  parseMinutes,
  wallDate,
  wallToUtc,
  weekdayOf,
} from "../src/lib/time";
import { fitsCapacity } from "../src/lib/availability";
import { slugify } from "../src/lib/defaults";
import { describeDeadline, isBookingEnabled } from "../src/lib/subscription";
import { hashIp, issueFormToken, looksLikeSpam, verifyFormToken } from "../src/lib/antispam";
import { retentionCutoff } from "../src/lib/privacy";
import { looksMobile, toE164 } from "../src/lib/phone";
import { buildBookingIcs, foldLine, icsTimestamp } from "../src/lib/ics";
import { WORKSHOPS } from "../prisma/demo-data";
import { matchesQuery } from "../src/lib/text";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

/* ---------- czas ---------- */

test("wallDate buduje godzinę ścienną w polach UTC", () => {
  assert.equal(wallDate("2026-08-18", 600).toISOString(), "2026-08-18T10:00:00.000Z");
  assert.equal(fmtTime(wallDate("2026-08-18", 600)), "10:00");
  assert.equal(minutesOf(wallDate("2026-08-18", 615)), 615);
});

test("weekdayOf: 0 = poniedziałek", () => {
  assert.equal(weekdayOf("2026-08-17"), 0); // poniedziałek
  assert.equal(weekdayOf("2026-08-18"), 1); // wtorek
  assert.equal(weekdayOf("2026-08-22"), 5); // sobota
  assert.equal(weekdayOf("2026-08-23"), 6); // niedziela
});

test("addDays przechodzi przez granicę miesiąca i roku", () => {
  assert.equal(addDays("2026-08-30", 3), "2026-09-02");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("addDays nie gubi doby przy zmianie czasu letniego", () => {
  // ostatnia niedziela października - w czasie lokalnym doba ma 25 h
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
  assert.equal(addDays("2026-10-25", 1), "2026-10-26");
  assert.equal(fmtTime(wallDate("2026-10-25", 9 * 60)), "09:00");
});

test("formatowanie dat po polsku", () => {
  assert.equal(fmtDateLong("2026-08-18"), "wtorek, 18 sierpnia 2026");
  assert.equal(fmtDateShort("2026-08-18"), "wt, 18.08");
  assert.equal(fmtMinutes(510), "08:30");
  assert.equal(parseMinutes("08:30"), 510);
  assert.equal(fmtDuration(90), "1 h 30 min");
  assert.equal(fmtDuration(45), "45 min");
  assert.equal(fmtDuration(120), "2 h");
});

test("dateKey i addMinutes", () => {
  assert.equal(dateKey(wallDate("2026-08-18", 23 * 60)), "2026-08-18");
  assert.equal(fmtTime(addMinutes(wallDate("2026-08-18", 570), 90)), "11:00");
});

test("nowWall zwraca czas warszawski", () => {
  const warsaw = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  assert.equal(fmtTime(nowWall()), warsaw.replace(".", ":"));
});

/* ---------- pojemność stanowisk ---------- */

const at = (h: number, m = 0) => wallDate("2026-08-18", h * 60 + m);
const span = (from: number, to: number) => ({ start: at(from).getTime(), end: at(to).getTime() });

test("pusty kalendarz zawsze się mieści", () => {
  assert.equal(fitsCapacity([], at(9), at(10), 1), true);
});

test("jedno stanowisko: nakładająca się wizyta blokuje", () => {
  assert.equal(fitsCapacity([span(9, 11)], at(10), at(12), 1), false);
  assert.equal(fitsCapacity([span(9, 11)], at(8), at(10), 1), false);
});

test("wizyty stykające się końcami nie kolidują", () => {
  assert.equal(fitsCapacity([span(9, 10)], at(10), at(11), 1), true);
  assert.equal(fitsCapacity([span(10, 11)], at(9), at(10), 1), true);
});

test("dwa stanowiska: druga wizyta się mieści, trzecia już nie", () => {
  assert.equal(fitsCapacity([span(9, 12)], at(10), at(11), 2), true);
  assert.equal(fitsCapacity([span(9, 12), span(9, 12)], at(10), at(11), 2), false);
});

test("liczy się szczyt nakładania, nie sama liczba wizyt", () => {
  // trzy wizyty w oknie, ale nigdy więcej niż jedna naraz
  const busy = [span(8, 9), span(9, 10), span(11, 12)];
  assert.equal(fitsCapacity(busy, at(8), at(12), 2), true);
  // te same trzy wizyty plus jedna długa: w godz. 8-9 i 9-10 mamy po 2 naraz
  assert.equal(fitsCapacity([...busy, span(8, 12)], at(8), at(12), 2), false);
});

test("częściowe nakładanie na krawędzi okna", () => {
  // wizyta 8:00-9:30 nakłada się na 9:00-10:00 tylko przez 30 min
  assert.equal(fitsCapacity([span(8, 9.5)], at(9), at(10), 1), false);
  assert.equal(fitsCapacity([span(8, 9.5)], at(9), at(10), 2), true);
});

test("wizyta zawierająca się w całości w innej", () => {
  assert.equal(fitsCapacity([span(8, 16)], at(10), at(11), 1), false);
  assert.equal(fitsCapacity([span(10, 11)], at(8), at(16), 1), false);
});

/* ---------- panel operatora ---------- */

test("slugify radzi sobie z polskimi znakami i interpunkcją", () => {
  assert.equal(slugify("Auto-Serwis Kowalski"), "auto-serwis-kowalski");
  assert.equal(slugify("Warsztat u Zdzisława"), "warsztat-u-zdzislawa");
  assert.equal(slugify("  Świeży Lakier & Detailing!  "), "swiezy-lakier-detailing");
  assert.equal(slugify("ŁÓDŹ MOTO"), "lodz-moto");
  assert.equal(slugify("!!!"), "");
});

test("wstrzymany abonament wyłącza rezerwacje, pozostałe nie", () => {
  assert.equal(isBookingEnabled({ subscriptionStatus: "ACTIVE" }), true);
  assert.equal(isBookingEnabled({ subscriptionStatus: "TRIAL" }), true);
  assert.equal(isBookingEnabled({ subscriptionStatus: "SUSPENDED" }), false);
});

test("opis terminu abonamentu rozróżnia zaległość od zapasu", () => {
  const day = 86_400_000;
  const now = nowWall().getTime();
  assert.equal(describeDeadline(null).text, "bez terminu");
  assert.equal(describeDeadline(new Date(now + 20 * day)).overdue, false);
  assert.equal(describeDeadline(new Date(now + 3 * day)).overdue, true); // ostrzegamy od 7 dni
  const late = describeDeadline(new Date(now - 5 * day));
  assert.equal(late.overdue, true);
  assert.match(late.text, /po terminie/);
});

/* ---------- ochrona formularza ---------- */

test("token formularza odrzuca wysyłkę w ułamku sekundy", () => {
  const now = 1_800_000_000_000;
  const token = issueFormToken(now);
  const tooFast = verifyFormToken(token, now + 500);
  assert.equal(tooFast.ok, false);
  assert.equal(verifyFormToken(token, now + 5_000).ok, true);
});

test("token formularza wygasa i nie da się go podrobić", () => {
  const now = 1_800_000_000_000;
  const token = issueFormToken(now);
  assert.equal(verifyFormToken(token, now + 5 * 3600_000).ok, false); // za stary
  assert.equal(verifyFormToken("1800000000000.deadbeef", now + 10_000).ok, false); // zły podpis
  assert.equal(verifyFormToken("", now).ok, false);
  const [ts, mac] = token.split(".");
  assert.equal(verifyFormToken(`${Number(ts) + 1}.${mac}`, now + 10_000).ok, false); // podmieniony czas
});

test("skrót adresu IP jest stabilny i różnicuje adresy", () => {
  assert.equal(hashIp("1.2.3.4"), hashIp("1.2.3.4"));
  assert.notEqual(hashIp("1.2.3.4"), hashIp("1.2.3.5"));
  assert.equal(hashIp("1.2.3.4").length, 32);
  assert.ok(!hashIp("1.2.3.4").includes("1.2.3.4")); // adresu nie da się odczytać
});

test("wykrywanie linków w treści zgłoszenia", () => {
  assert.equal(looksLikeSpam("Stuka przy skręcaniu"), false);
  assert.equal(looksLikeSpam("kup tanio http://spam.example"), true);
  assert.equal(looksLikeSpam("zobacz www.spam.example"), true);
});

test("granica retencji cofa się o pełne miesiące", () => {
  const now = new Date(Date.UTC(2026, 7, 28)); // 28 sierpnia 2026
  assert.equal(retentionCutoff(24, now).toISOString().slice(0, 10), "2024-08-28");
  assert.equal(retentionCutoff(6, now).toISOString().slice(0, 10), "2026-02-28");
});

/* ---------- numery telefonu ---------- */

test("numery zamieniają się na format międzynarodowy", () => {
  assert.equal(toE164("601 234 567"), "+48601234567");
  assert.equal(toE164("601-234-567"), "+48601234567");
  assert.equal(toE164("+48 601 234 567"), "+48601234567");
  assert.equal(toE164("0048601234567"), "+48601234567");
  assert.equal(toE164("0601234567"), "+48601234567");
  assert.equal(toE164("48601234567"), "+48601234567");
  assert.equal(toE164("123"), null);
  assert.equal(toE164(""), null);
  assert.equal(toE164(null), null);
});

test("SMS-a nie wysyłamy na numer stacjonarny", () => {
  assert.equal(looksMobile("+48601234567"), true);
  assert.equal(looksMobile("+48501234567"), true);
  assert.equal(looksMobile("+48221234567"), false); // Warszawa, stacjonarny
  assert.equal(looksMobile("+48122345678"), false); // Kraków
  assert.equal(looksMobile(null), false);
});

/* ---------- czas ścienny → UTC ---------- */

test("konwersja do UTC uwzględnia czas letni i zimowy", () => {
  // 15 stycznia, CET = UTC+1 → 10:00 lokalnie to 09:00 UTC
  assert.equal(wallToUtc(wallDate("2026-01-15", 10 * 60)).toISOString(), "2026-01-15T09:00:00.000Z");
  // 15 lipca, CEST = UTC+2 → 10:00 lokalnie to 08:00 UTC
  assert.equal(wallToUtc(wallDate("2026-07-15", 10 * 60)).toISOString(), "2026-07-15T08:00:00.000Z");
});

test("konwersja działa po obu stronach zmiany czasu", () => {
  // zmiana na letni: 29 marca 2026, 02:00 → 03:00
  assert.equal(wallToUtc(wallDate("2026-03-29", 1 * 60)).toISOString(), "2026-03-29T00:00:00.000Z");
  assert.equal(wallToUtc(wallDate("2026-03-29", 5 * 60)).toISOString(), "2026-03-29T03:00:00.000Z");
  // zmiana na zimowy: 25 października 2026
  assert.equal(wallToUtc(wallDate("2026-10-25", 5 * 60)).toISOString(), "2026-10-25T04:00:00.000Z");
});

/* ---------- plik kalendarza ---------- */

test("znacznik czasu w formacie iCalendar", () => {
  assert.equal(icsTimestamp(new Date("2026-08-28T09:30:00.000Z")), "20260828T093000Z");
});

test("długie linie łamią się zgodnie ze standardem", () => {
  const short = "SUMMARY:krótko";
  assert.equal(foldLine(short), short);

  const long = "DESCRIPTION:" + "a".repeat(200);
  const folded = foldLine(long);
  assert.ok(folded.includes("\r\n "));
  for (const line of folded.split("\r\n")) {
    assert.ok(Buffer.from(line, "utf8").length <= 76, `linia za długa: ${line.length}`);
  }
  // po sklejeniu wraca oryginał
  assert.equal(folded.split("\r\n ").join(""), long);
});

test("plik kalendarza ma poprawną strukturę i przeliczoną godzinę", () => {
  const ics = buildBookingIcs({
    uid: "abc@test",
    startAt: wallDate("2026-07-15", 10 * 60),
    endAt: wallDate("2026-07-15", 11 * 60 + 30),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    serviceName: "Wymiana klocków; przód",
    workshopName: "Auto-Serwis Kowalski",
    workshopPhone: "600 100 200",
    workshopAddress: "ul. Warsztatowa 12, Warszawa",
    carModel: "Skoda Octavia",
    status: "CONFIRMED",
    manageUrl: "https://example.test/w/demo/rezerwacja/abc",
    alarmHoursBefore: 24,
  });

  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.ok(ics.includes("DTSTART:20260715T080000Z")); // 10:00 lokalnie latem
  assert.ok(ics.includes("DTEND:20260715T093000Z"));
  assert.ok(ics.includes("STATUS:CONFIRMED"));
  assert.ok(ics.includes("TRIGGER:-PT24H"));
  assert.ok(ics.includes("\\;"), "średnik w nazwie usługi musi być poprzedzony ukośnikiem");
  assert.ok(ics.includes("\\,"), "przecinek w adresie musi być poprzedzony ukośnikiem");
  // każda linia kończy się CRLF
  assert.equal(ics.split("\n").every((l, i, arr) => i === arr.length - 1 || l.endsWith("\r")), true);
});

test("odwołana wizyta ma status CANCELLED w kalendarzu", () => {
  const ics = buildBookingIcs({
    uid: "x@test", startAt: wallDate("2026-07-15", 600), endAt: wallDate("2026-07-15", 660),
    updatedAt: new Date(), serviceName: "Test", workshopName: "W", workshopPhone: null,
    workshopAddress: null, carModel: "Auto", status: "CANCELLED",
    manageUrl: "https://example.test/x", alarmHoursBefore: 24,
  });
  assert.ok(ics.includes("STATUS:CANCELLED"));
});

/* ---------- spójność danych demonstracyjnych ---------- */

test("dane demo: trzy warsztaty o unikalnych adresach i loginach", () => {
  assert.equal(WORKSHOPS.length, 3);
  const slugs = WORKSHOPS.map((w) => w.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const w of WORKSHOPS) {
    assert.ok(/^[a-z0-9-]+$/.test(w.slug), `zły adres: ${w.slug}`);
    assert.ok(w.password.length >= 8, `za krótkie hasło: ${w.slug}`);
    assert.ok(w.services.length > 0, `brak usług: ${w.slug}`);
  }
});

test("dane demo: każda rezerwacja wskazuje na istniejącą usługę", () => {
  for (const w of WORKSHOPS) {
    for (const b of w.bookings) {
      assert.ok(
        b.service >= 0 && b.service < w.services.length,
        `${w.slug}: rezerwacja wskazuje usługę ${b.service}, a jest ich ${w.services.length}`,
      );
    }
  }
});

test("dane demo: wizyty mieszczą się w godzinach pracy", () => {
  for (const w of WORKSHOPS) {
    for (const b of w.bookings) {
      const duration = w.services[b.service].durationMin;
      assert.ok(
        b.minutes >= w.hours.weekdayOpen && b.minutes + duration <= w.hours.weekdayClose,
        `${w.slug}: wizyta ${b.minutes} + ${duration} min wychodzi poza ${w.hours.weekdayClose}`,
      );
    }
  }
});

test("dane demo: da się w ogóle zarezerwować każdą widoczną usługę", () => {
  for (const w of WORKSHOPS) {
    const window = w.hours.weekdayClose - w.hours.weekdayOpen;
    for (const s of w.services) {
      if (s.active === false) continue;
      assert.ok(
        s.durationMin <= window,
        `${w.slug}: „${s.name}” trwa ${s.durationMin} min, a dzień pracy ma ${window} min`,
      );
    }
  }
});

test("dane demo: pokrywają skrajne przypadki do testowania", () => {
  const statuses = new Set(WORKSHOPS.flatMap((w) => w.bookings.map((b) => b.status)));
  for (const s of ["PENDING", "CONFIRMED", "PROPOSED", "REJECTED", "CANCELLED", "DONE"]) {
    assert.ok(statuses.has(s as never), `brak przykładu ze statusem ${s}`);
  }
  assert.ok(WORKSHOPS.some((w) => w.subscriptionStatus === "SUSPENDED"), "brak wstrzymanego");
  assert.ok(WORKSHOPS.some((w) => w.smsEnabled), "brak warsztatu z SMS-ami");
  assert.ok(WORKSHOPS.some((w) => w.bays === 1), "brak warsztatu z jednym stanowiskiem");
  assert.ok(WORKSHOPS.some((w) => w.bays >= 3), "brak warsztatu z wieloma stanowiskami");
  assert.ok(WORKSHOPS.some((w) => w.email === null), "brak warsztatu bez maila");
  assert.ok(
    WORKSHOPS.flatMap((w) => w.bookings).some((b) => b.source === "PHONE"),
    "brak wizyty wpisanej ręcznie",
  );
});

/* ---------- wyszukiwarka klientów ---------- */

test("wyszukiwarka nie rozróżnia wielkości liter ani ogonków", () => {
  const klient = ["Marek Zieliński", "601 234 567", "WX 12345", "Skoda Octavia"];
  assert.equal(matchesQuery(klient, "zieliński"), true);
  assert.equal(matchesQuery(klient, "ZIELINSKI"), true); // bez ogonka
  assert.equal(matchesQuery(klient, "zielinsk"), true);
  assert.equal(matchesQuery(klient, "skoda"), true);
  assert.equal(matchesQuery(klient, "wx 123"), true);
  assert.equal(matchesQuery(klient, "nowak"), false);
});

test("puste zapytanie pasuje do wszystkich, puste pola nie wysypują", () => {
  assert.equal(matchesQuery(["Anna"], ""), true);
  assert.equal(matchesQuery(["Anna"], "   "), true);
  assert.equal(matchesQuery([null, undefined, "Anna"], "anna"), true);
  assert.equal(matchesQuery([null, undefined], "anna"), false);
});

console.log(`\n  ${passed} testów przeszło.\n`);
