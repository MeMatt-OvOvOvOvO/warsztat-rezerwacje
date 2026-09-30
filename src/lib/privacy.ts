import { db } from "./db";
import { nowWall } from "./time";

/**
 * RODO w praktyce: dane klienta żyją tylko tak długo, jak są potrzebne.
 *
 * Nie kasujemy całych rezerwacji, bo warsztat ma prawo (i obowiązek podatkowy)
 * wiedzieć, ile wizyt wykonał. Zamiast tego czyścimy dane osobowe, zostawiając
 * sam fakt wizyty: usługa, termin, status. To jest anonimizacja, po której
 * rekord przestaje być daną osobową.
 */

export const ANONYMIZED = {
  customerName: "Dane usunięte",
  customerPhone: "",
  customerEmail: null,
  carModel: "—",
  carPlate: null,
  notes: null,
  ipHash: null,
};

function anonymizedPayload(now: Date) {
  return { ...ANONYMIZED, anonymizedAt: now };
}

/**
 * Realizacja żądania usunięcia danych („prawo do bycia zapomnianym”).
 * Czyści wszystkie wizyty powiązane z jednym numerem telefonu w danym warsztacie.
 */
export async function anonymizeCustomer(workshopId: string, phone: string): Promise<number> {
  const now = nowWall();
  const result = await db.booking.updateMany({
    where: { workshopId, customerPhone: phone, anonymizedAt: null },
    data: anonymizedPayload(now),
  });
  return result.count;
}

/** Anonimizuje pojedynczą rezerwację. */
export async function anonymizeBooking(id: string): Promise<void> {
  await db.booking.update({ where: { id }, data: anonymizedPayload(nowWall()) });
}

/**
 * Sprzątanie po okresie retencji — do uruchamiania cyklicznie
 * (`npm run rodo:cleanup`, docelowo raz na dobę zadaniem cron).
 * Zwraca liczbę wyczyszczonych rezerwacji w rozbiciu na warsztaty.
 */
export async function runRetention(): Promise<{ workshop: string; anonymized: number }[]> {
  const now = nowWall();
  const workshops = await db.workshop.findMany();
  const report: { workshop: string; anonymized: number }[] = [];

  for (const w of workshops) {
    const cutoff = new Date(now);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - w.retentionMonths);

    const result = await db.booking.updateMany({
      where: { workshopId: w.id, endAt: { lt: cutoff }, anonymizedAt: null },
      data: anonymizedPayload(now),
    });

    report.push({ workshop: w.name, anonymized: result.count });
  }

  return report;
}

/** Data, od której wizyty danego warsztatu są jeszcze przechowywane z danymi. */
export function retentionCutoff(retentionMonths: number, now = nowWall()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - retentionMonths);
  return cutoff;
}
