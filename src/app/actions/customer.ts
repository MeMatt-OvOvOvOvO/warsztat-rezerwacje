"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { appUrl, sendMail } from "@/lib/notify";
import { fmtDateTime } from "@/lib/time";

async function loadByToken(token: string) {
  return db.booking.findUnique({
    where: { manageToken: token },
    include: { workshop: true, service: true },
  });
}

/** Klient odwołuje wizytę linkiem z maila. */
export async function cancelBooking(formData: FormData) {
  const token = String(formData.get("token") || "");
  const booking = await loadByToken(token);
  if (!booking) return;
  if (["CANCELLED", "REJECTED", "DONE"].includes(booking.status)) return;

  await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });

  await sendMail({
    to: booking.workshop.email,
    subject: `Klient odwołał wizytę — ${fmtDateTime(booking.startAt)}`,
    text: [
      `${booking.customerName} (${booking.customerPhone}) odwołał wizytę.`,
      "",
      `Usługa: ${booking.service.name}`,
      `Termin: ${fmtDateTime(booking.startAt)}`,
      "",
      `Slot jest znowu wolny w kalendarzu: ${appUrl("/panel/kalendarz")}`,
    ].join("\n"),
  });

  revalidatePath(`/w/${booking.workshop.slug}/rezerwacja/${token}`);
}

/** Klient akceptuje termin zaproponowany przez warsztat. */
export async function acceptProposal(formData: FormData) {
  const token = String(formData.get("token") || "");
  const booking = await loadByToken(token);
  if (!booking || booking.status !== "PROPOSED") return;

  await db.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });

  await sendMail({
    to: booking.workshop.email,
    subject: `Klient przyjął nowy termin — ${fmtDateTime(booking.startAt)}`,
    text: [
      `${booking.customerName} (${booking.customerPhone}) zaakceptował zaproponowany termin.`,
      "",
      `Usługa: ${booking.service.name}`,
      `Termin: ${fmtDateTime(booking.startAt)}`,
    ].join("\n"),
  });

  revalidatePath(`/w/${booking.workshop.slug}/rezerwacja/${token}`);
}

/** Klient odrzuca zaproponowany termin. */
export async function declineProposal(formData: FormData) {
  const token = String(formData.get("token") || "");
  const booking = await loadByToken(token);
  if (!booking || booking.status !== "PROPOSED") return;

  await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });

  await sendMail({
    to: booking.workshop.email,
    subject: "Klient nie przyjął zaproponowanego terminu",
    text: [
      `${booking.customerName} (${booking.customerPhone}) nie przyjął terminu ${fmtDateTime(booking.startAt)}.`,
      "",
      "Warto oddzwonić i ustalić termin bezpośrednio.",
    ].join("\n"),
  });

  revalidatePath(`/w/${booking.workshop.slug}/rezerwacja/${token}`);
}
