import { db } from "./db";
import { appUrl, sendMail, sendSms } from "./notify";
import { looksMobile, toE164 } from "./phone";
import { fmtDateTime, fmtTime, nowWall } from "./time";

/**
 * Przypomnienia o zbliżającej się wizycie.
 *
 * Uruchamiane cyklicznie (`npm run przypomnienia` albo zadanie cron pod
 * /api/cron/przypomnienia). Wysyłamy tylko dla wizyt potwierdzonych — klient,
 * którego zgłoszenie nadal czeka na decyzję warsztatu, dostałby przypomnienie
 * o czymś, co może się nie odbyć.
 *
 * Pole reminderSentAt pilnuje, żeby to samo przypomnienie nie wyszło dwa razy,
 * nawet jeśli zadanie odpali się częściej niż raz na dobę.
 */

export type ReminderReport = {
  sent: number;
  sms: number;
  mail: number;
  skipped: number;
  lines: string[];
};

export async function sendDueReminders(): Promise<ReminderReport> {
  const now = nowWall();
  const report: ReminderReport = { sent: 0, sms: 0, mail: 0, skipped: 0, lines: [] };

  const workshops = await db.workshop.findMany({ where: { remindersEnabled: true } });

  for (const workshop of workshops) {
    const horizon = new Date(now.getTime() + workshop.reminderHoursBefore * 3_600_000);

    const bookings = await db.booking.findMany({
      where: {
        workshopId: workshop.id,
        status: "CONFIRMED",
        reminderSentAt: null,
        anonymizedAt: null,
        startAt: { gt: now, lte: horizon },
      },
      include: { service: true },
      orderBy: { startAt: "asc" },
    });

    for (const booking of bookings) {
      const manageUrl = appUrl(`/w/${workshop.slug}/rezerwacja/${booking.manageToken}`);
      let smsOk = false;
      let mailOk = false;

      if (workshop.smsEnabled) {
        const number = toE164(booking.customerPhone);
        if (looksMobile(number)) {
          const text = [
            `${workshop.name}: przypominamy o wizycie ${fmtDateTime(booking.startAt)}.`,
            `${booking.service.name}, ${booking.carModel}.`,
            `Odwołanie: ${manageUrl}`,
          ].join(" ");
          smsOk = await sendSms(number, text);
          if (smsOk) report.sms += 1;
        }
      }

      if (booking.customerEmail) {
        await sendMail({
          to: booking.customerEmail,
          subject: `Przypomnienie o wizycie — ${workshop.name}`,
          text: [
            `Przypominamy o zaplanowanej wizycie.`,
            "",
            `Usługa: ${booking.service.name}`,
            `Termin: ${fmtDateTime(booking.startAt)} – ${fmtTime(booking.endAt)}`,
            `Auto:   ${booking.carModel}`,
            workshop.address ? `Adres:  ${workshop.address}` : "",
            workshop.phone ? `Telefon: ${workshop.phone}` : "",
            "",
            `Dodaj do kalendarza: ${manageUrl}/kalendarz.ics`,
            `Odwołanie wizyty:    ${manageUrl}`,
          ]
            .filter(Boolean)
            .join("\n"),
        });
        mailOk = true;
        report.mail += 1;
      }

      // Oznaczamy także wtedy, gdy nie było czym wysłać — inaczej przy każdym
      // uruchomieniu w kółko próbowalibyśmy tej samej wizyty.
      await db.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: now },
      });

      if (smsOk || mailOk) {
        report.sent += 1;
        report.lines.push(
          `${workshop.name}: ${booking.customerName}, ${fmtDateTime(booking.startAt)} → ` +
            [smsOk ? "SMS" : null, mailOk ? "mail" : null].filter(Boolean).join(" + "),
        );
      } else {
        report.skipped += 1;
        report.lines.push(
          `${workshop.name}: ${booking.customerName}, ${fmtDateTime(booking.startAt)} → brak kanału (bez maila, SMS wyłączony lub numer stacjonarny)`,
        );
      }
    }
  }

  return report;
}
