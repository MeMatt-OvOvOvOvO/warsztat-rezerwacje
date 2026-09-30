import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkshopOrRedirect } from "@/lib/auth";
import {
  addDays,
  dateKey,
  dayName,
  fmtDateLong,
  fmtMinutes,
  fmtTime,
  minutesOf,
  nowWall,
  wallDate,
  weekdayOf,
} from "@/lib/time";
import { STATUS_SHORT, statusClass, type BookingStatusValue } from "@/lib/status";

export const dynamic = "force-dynamic";

const ACTIVE = ["PENDING", "PROPOSED", "CONFIRMED", "DONE"] as const;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const workshop = await requireWorkshopOrRedirect();
  const sp = await searchParams;

  const today = dateKey(nowWall());
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const view = sp.view === "tydzien" ? "tydzien" : "dzien";

  const rangeStart = view === "dzien" ? date : addDays(date, -weekdayOf(date));
  const rangeDays = view === "dzien" ? 1 : 7;
  const rangeEnd = addDays(rangeStart, rangeDays);

  const [bookings, hours, timeOff] = await Promise.all([
    db.booking.findMany({
      where: {
        workshopId: workshop.id,
        status: { in: [...ACTIVE] },
        startAt: { lt: wallDate(rangeEnd) },
        endAt: { gt: wallDate(rangeStart) },
      },
      include: { service: true },
      orderBy: { startAt: "asc" },
    }),
    db.workingHours.findMany({ where: { workshopId: workshop.id } }),
    db.timeOff.findMany({
      where: {
        workshopId: workshop.id,
        startAt: { lt: wallDate(rangeEnd) },
        endAt: { gt: wallDate(rangeStart) },
      },
    }),
  ]);

  const dayKeys = Array.from({ length: rangeDays }, (_, i) => addDays(rangeStart, i));
  const step = view === "dzien" ? -1 : -7;

  const hoursByWeekday = new Map(hours.map((h) => [h.weekday, h]));

  return (
    <main>
      <div className="row-between mb">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h1>Kalendarz</h1>
          <p>Wszystkie wizyty — oczekujące, potwierdzone i zrealizowane.</p>
        </div>
        <div className="toolbar">
          <Link className="btn btn-sm btn-primary" href="/panel/nowa-wizyta">
            + Wizyta
          </Link>
          <Link className="btn btn-sm" href={`/panel/kalendarz?view=dzien&date=${today}`}>
            Dziś
          </Link>
          <Link
            className="btn btn-sm"
            href={`/panel/kalendarz?view=${view}&date=${addDays(date, step)}`}
          >
            ←
          </Link>
          <Link
            className="btn btn-sm"
            href={`/panel/kalendarz?view=${view}&date=${addDays(date, -step)}`}
          >
            →
          </Link>
          <Link
            className={`btn btn-sm${view === "dzien" ? " btn-primary" : ""}`}
            href={`/panel/kalendarz?view=dzien&date=${date}`}
          >
            Dzień
          </Link>
          <Link
            className={`btn btn-sm${view === "tydzien" ? " btn-primary" : ""}`}
            href={`/panel/kalendarz?view=tydzien&date=${date}`}
          >
            Tydzień
          </Link>
        </div>
      </div>

      {view === "dzien" ? (
        <DayView
          dayKey={date}
          bookings={bookings}
          openMin={hoursByWeekday.get(weekdayOf(date))?.openMin ?? 480}
          closeMin={hoursByWeekday.get(weekdayOf(date))?.closeMin ?? 1020}
          isClosed={hoursByWeekday.get(weekdayOf(date))?.isClosed ?? true}
          timeOff={timeOff}
          bays={workshop.bays}
        />
      ) : (
        <div className="stack">
          {dayKeys.map((key) => {
            const dayBookings = bookings.filter((b) => dateKey(b.startAt) === key);
            const wh = hoursByWeekday.get(weekdayOf(key));
            return (
              <div className="card card-tight" key={key}>
                <div className="row-between">
                  <strong style={{ textTransform: "capitalize" }}>
                    {dayName(weekdayOf(key))}, {key.slice(8)}.{key.slice(5, 7)}
                  </strong>
                  <span className="muted small">
                    {wh && !wh.isClosed
                      ? `${fmtMinutes(wh.openMin)}–${fmtMinutes(wh.closeMin)}`
                      : "nieczynne"}
                  </span>
                </div>
                {dayBookings.length === 0 ? (
                  <div className="muted small mt">brak wizyt</div>
                ) : (
                  <div className="mt">
                    {dayBookings.map((b) => (
                      <Link
                        key={b.id}
                        href={`/panel/rezerwacja/${b.id}`}
                        className={`appt ${b.status.toLowerCase()}`}
                        style={{ display: "block", textDecoration: "none", color: "inherit" }}
                      >
                        <strong>
                          {fmtTime(b.startAt)}–{fmtTime(b.endAt)}
                        </strong>{" "}
                        {b.service.name}
                        <span className="muted"> · {b.customerName}</span>{" "}
                        <span className={statusClass(b.status)}>
                          {STATUS_SHORT[b.status as BookingStatusValue]}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

type BookingRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: string;
  source: string;
  customerName: string;
  customerPhone: string;
  carModel: string;
  service: { name: string };
};

function DayView({
  dayKey,
  bookings,
  openMin,
  closeMin,
  isClosed,
  timeOff,
  bays,
}: {
  dayKey: string;
  bookings: BookingRow[];
  openMin: number;
  closeMin: number;
  isClosed: boolean;
  timeOff: { id: string; startAt: Date; endAt: Date; reason: string | null }[];
  bays: number;
}) {
  const dayBookings = bookings.filter((b) => dateKey(b.startAt) === dayKey);
  const firstHour = Math.floor(Math.min(openMin, ...dayBookings.map((b) => minutesOf(b.startAt))) / 60);
  const lastHour = Math.ceil(Math.max(closeMin, ...dayBookings.map((b) => minutesOf(b.endAt))) / 60);

  const rows = [];
  for (let h = firstHour; h < lastHour; h++) {
    const inHour = dayBookings.filter((b) => Math.floor(minutesOf(b.startAt) / 60) === h);
    rows.push(
      <div className="timeline-row" key={h}>
        <div className="timeline-time">{String(h).padStart(2, "0")}:00</div>
        <div>
          {inHour.map((b) => (
            <Link
              key={b.id}
              href={`/panel/rezerwacja/${b.id}`}
              className={`appt ${b.status.toLowerCase()}`}
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <strong>
                {fmtTime(b.startAt)}–{fmtTime(b.endAt)}
              </strong>{" "}
              {b.service.name}{" "}
              <span className={statusClass(b.status)}>
                {STATUS_SHORT[b.status as BookingStatusValue]}
              </span>
              <div className="muted small">
                {b.customerName} · {b.customerPhone} · {b.carModel}
                {b.source === "PHONE" ? " · wpisana ręcznie" : ""}
              </div>
            </Link>
          ))}
        </div>
      </div>,
    );
  }

  const dayTimeOff = timeOff.filter((t) => dateKey(t.startAt) === dayKey);

  return (
    <div className="card">
      <div className="row-between mb">
        <h2 style={{ margin: 0, textTransform: "capitalize" }}>{fmtDateLong(dayKey)}</h2>
        <span className="muted small">
          {isClosed ? "nieczynne" : `${fmtMinutes(openMin)}–${fmtMinutes(closeMin)}`} · {bays}{" "}
          {bays === 1 ? "stanowisko" : "stanowiska"}
        </span>
      </div>

      {dayTimeOff.length > 0 && (
        <div className="alert alert-info">
          Przerwy:{" "}
          {dayTimeOff
            .map((t) => `${fmtTime(t.startAt)}–${fmtTime(t.endAt)}${t.reason ? ` (${t.reason})` : ""}`)
            .join(", ")}
        </div>
      )}

      {dayBookings.length === 0 ? (
        <div className="empty">Brak wizyt tego dnia.</div>
      ) : (
        <div className="timeline">{rows}</div>
      )}
    </div>
  );
}
