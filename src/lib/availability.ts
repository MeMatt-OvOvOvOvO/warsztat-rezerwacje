import { db } from "./db";
import { addDays, addMinutes, dateKey, fmtTime, minutesOf, nowWall, wallDate, weekdayOf } from "./time";

/** Statusy, które faktycznie zajmują stanowisko w kalendarzu. */
export const BLOCKING_STATUSES = ["PENDING", "PROPOSED", "CONFIRMED", "DONE"] as const;

type Interval = { start: number; end: number };

export type Slot = { start: string; label: string };

export type DayAvailability = {
  date: string; // YYYY-MM-DD
  weekday: number; // 0 = poniedziałek
  closed: boolean; // warsztat nieczynny tego dnia
  slots: Slot[];
};

/**
 * Sprawdza, czy przedział [start, end) zmieści się przy danej liczbie stanowisk.
 * Nie wystarczy policzyć nakładających się wizyt - trzeba znaleźć moment
 * o największym natężeniu, bo wizyty mogą się nakładać częściowo.
 */
export function fitsCapacity(busy: Interval[], start: Date, end: Date, bays: number): boolean {
  const s = start.getTime();
  const e = end.getTime();
  const overlapping = busy.filter((b) => b.start < e && b.end > s);
  if (overlapping.length < bays) return true;

  const events: Array<[number, number]> = [];
  for (const b of overlapping) {
    events.push([Math.max(b.start, s), 1]);
    events.push([Math.min(b.end, e), -1]);
  }
  // przy równych znacznikach najpierw zwalniamy stanowisko, potem zajmujemy
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let current = 0;
  let peak = 0;
  for (const [, delta] of events) {
    current += delta;
    if (current > peak) peak = current;
  }
  return peak < bays;
}

/**
 * Wolne terminy dla jednej usługi w zadanym zakresie dni.
 * Zwraca wpis dla każdego dnia, także dla dni zamkniętych - front rysuje z tego pasek dat.
 */
export async function getAvailability(opts: {
  workshopId: string;
  serviceId: string;
  from: string; // YYYY-MM-DD
  days: number;
  /** ignoruj czas wyprzedzenia i limit dni w przód (panel właściciela) */
  ignoreLeadTime?: boolean;
  /** pomiń tę rezerwację przy liczeniu obłożenia (zmiana terminu) */
  excludeBookingId?: string;
}): Promise<DayAvailability[]> {
  const { workshopId, serviceId, from, days } = opts;

  const [workshop, service] = await Promise.all([
    db.workshop.findUnique({
      where: { id: workshopId },
      include: { workingHours: true },
    }),
    db.service.findUnique({ where: { id: serviceId } }),
  ]);

  if (!workshop || !service || service.workshopId !== workshopId) return [];

  const rangeStart = wallDate(from);
  const rangeEnd = wallDate(addDays(from, days));

  const [bookings, timeOff] = await Promise.all([
    db.booking.findMany({
      where: {
        workshopId,
        status: { in: [...BLOCKING_STATUSES] },
        startAt: { lt: rangeEnd },
        endAt: { gt: rangeStart },
        ...(opts.excludeBookingId ? { NOT: { id: opts.excludeBookingId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    db.timeOff.findMany({
      where: { workshopId, startAt: { lt: rangeEnd }, endAt: { gt: rangeStart } },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const busy: Interval[] = bookings.map((b) => ({
    start: b.startAt.getTime(),
    end: b.endAt.getTime(),
  }));
  const blocks: Interval[] = timeOff.map((t) => ({
    start: t.startAt.getTime(),
    end: t.endAt.getTime(),
  }));

  const hoursByWeekday = new Map(workshop.workingHours.map((h) => [h.weekday, h]));

  const now = nowWall();
  const earliest = opts.ignoreLeadTime
    ? now.getTime()
    : now.getTime() + workshop.leadTimeHours * 3_600_000;
  const latest = opts.ignoreLeadTime
    ? Number.POSITIVE_INFINITY
    : wallDate(dateKey(now)).getTime() + (workshop.maxAdvanceDays + 1) * 86_400_000;

  const result: DayAvailability[] = [];

  for (let i = 0; i < days; i++) {
    const key = addDays(from, i);
    const weekday = weekdayOf(key);
    const hours = hoursByWeekday.get(weekday);

    if (!hours || hours.isClosed || hours.closeMin - hours.openMin < service.durationMin) {
      result.push({ date: key, weekday, closed: true, slots: [] });
      continue;
    }

    const slots: Slot[] = [];
    for (let m = hours.openMin; m + service.durationMin <= hours.closeMin; m += workshop.slotStepMin) {
      const start = wallDate(key, m);
      const end = addMinutes(start, service.durationMin);

      if (start.getTime() < earliest) continue;
      if (start.getTime() >= latest) continue;
      if (blocks.some((b) => b.start < end.getTime() && b.end > start.getTime())) continue;
      if (!fitsCapacity(busy, start, end, workshop.bays)) continue;

      slots.push({ start: start.toISOString(), label: fmtTime(start) });
    }

    result.push({ date: key, weekday, closed: false, slots });
  }

  return result;
}

/**
 * Kontrola przy zapisie - między wyświetleniem kalendarza a kliknięciem
 * ktoś inny mógł zająć ten sam slot.
 */
export async function isSlotBookable(opts: {
  workshopId: string;
  serviceId: string;
  start: Date;
  ignoreLeadTime?: boolean;
  excludeBookingId?: string;
}): Promise<{ ok: true; end: Date } | { ok: false; reason: string }> {
  const { workshopId, serviceId, start } = opts;

  const [workshop, service] = await Promise.all([
    db.workshop.findUnique({ where: { id: workshopId }, include: { workingHours: true } }),
    db.service.findUnique({ where: { id: serviceId } }),
  ]);

  if (!workshop || !service || service.workshopId !== workshopId) {
    return { ok: false, reason: "Nie znaleziono usługi." };
  }

  const end = addMinutes(start, service.durationMin);
  const now = nowWall();

  if (!opts.ignoreLeadTime) {
    if (start.getTime() < now.getTime() + workshop.leadTimeHours * 3_600_000) {
      return {
        ok: false,
        reason: `Termin musi być co najmniej ${workshop.leadTimeHours} h w przód.`,
      };
    }
    const hours = workshop.workingHours.find((h) => h.weekday === weekdayOf(start));
    if (!hours || hours.isClosed) {
      return { ok: false, reason: "Warsztat jest tego dnia nieczynny." };
    }
    const startMin = minutesOf(start);
    if (startMin < hours.openMin || startMin + service.durationMin > hours.closeMin) {
      return { ok: false, reason: "Termin wykracza poza godziny pracy warsztatu." };
    }
  }

  const blocking = await db.timeOff.count({
    where: { workshopId, startAt: { lt: end }, endAt: { gt: start } },
  });
  if (blocking > 0) return { ok: false, reason: "W tym czasie warsztat ma przerwę." };

  const overlapping = await db.booking.findMany({
    where: {
      workshopId,
      status: { in: [...BLOCKING_STATUSES] },
      startAt: { lt: end },
      endAt: { gt: start },
      ...(opts.excludeBookingId ? { NOT: { id: opts.excludeBookingId } } : {}),
    },
    select: { startAt: true, endAt: true },
  });

  const busy = overlapping.map((b) => ({ start: b.startAt.getTime(), end: b.endAt.getTime() }));
  if (!fitsCapacity(busy, start, end, workshop.bays)) {
    return { ok: false, reason: "Ten termin został właśnie zajęty. Wybierz inny." };
  }

  return { ok: true, end };
}
