"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  newToken,
  requireWorkshop,
  verifyPassword,
} from "@/lib/auth";
import { isSlotBookable } from "@/lib/availability";
import { appUrl, sendMail } from "@/lib/notify";
import { addMinutes, dateKey, fmtDateTime, parseMinutes, wallDate } from "@/lib/time";
import { anonymizeCustomer } from "@/lib/privacy";

/* ---------------- logowanie ---------------- */

export async function login(formData: FormData) {
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const workshop = await db.workshop.findUnique({ where: { slug } });
  if (!workshop || !verifyPassword(password, workshop.passwordHash)) {
    redirect("/panel/login?error=1");
  }

  await createSession(workshop.id);
  redirect("/panel");
}

export async function logout() {
  await destroySession();
  redirect("/panel/login");
}

/**
 * Wynik akcji formularza. Akcje, w których użytkownik realnie może trafić na
 * błąd (zajęty termin, zła godzina), zwracają go tym typem i pokazują nad
 * formularzem. Wyjątki zostawiamy na sytuacje niemożliwe do naprawienia przez
 * użytkownika — te łapie ekran awarii w src/app/error.tsx.
 */
export type ActionState = { error?: string; saved?: boolean };

/* ---------------- obsługa zgłoszeń ---------------- */

async function loadOwnBooking(id: string) {
  const workshop = await requireWorkshop();
  const booking = await db.booking.findUnique({
    where: { id },
    include: { service: true, workshop: true },
  });
  if (!booking || booking.workshopId !== workshop.id) {
    throw new Error("Nie znaleziono rezerwacji.");
  }
  return booking;
}

function manageLink(slug: string, token: string) {
  return appUrl(`/w/${slug}/rezerwacja/${token}`);
}

export async function acceptBooking(formData: FormData) {
  const booking = await loadOwnBooking(String(formData.get("id") || ""));

  await db.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });

  await sendMail({
    to: booking.customerEmail,
    subject: `Wizyta potwierdzona — ${booking.workshop.name}`,
    text: [
      `Dobra wiadomość: warsztat potwierdził Twój termin.`,
      "",
      `Usługa: ${booking.service.name}`,
      `Termin: ${fmtDateTime(booking.startAt)}`,
      booking.workshop.address ? `Adres:  ${booking.workshop.address}` : "",
      "",
      `Dodaj do kalendarza: ${manageLink(booking.workshop.slug, booking.manageToken)}/kalendarz.ics`,
      `Gdyby coś się zmieniło, możesz odwołać wizytę tutaj: ${manageLink(booking.workshop.slug, booking.manageToken)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  revalidatePath("/panel");
  revalidatePath("/panel/kalendarz");
}

export async function rejectBooking(formData: FormData) {
  const booking = await loadOwnBooking(String(formData.get("id") || ""));
  const note = String(formData.get("note") || "").trim().slice(0, 500);

  await db.booking.update({
    where: { id: booking.id },
    data: { status: "REJECTED", workshopNote: note || null },
  });

  await sendMail({
    to: booking.customerEmail,
    subject: `Nie możemy przyjąć tego terminu — ${booking.workshop.name}`,
    text: [
      `Niestety warsztat nie może przyjąć zgłoszenia na ${fmtDateTime(booking.startAt)}.`,
      note ? `Powód: ${note}` : "",
      "",
      `Możesz wybrać inny termin: ${appUrl(`/w/${booking.workshop.slug}`)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  revalidatePath("/panel");
  revalidatePath("/panel/kalendarz");
}

/** Warsztat proponuje klientowi inną godzinę. */
export async function proposeTime(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const booking = await loadOwnBooking(String(formData.get("id") || ""));
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 500);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { error: "Podaj poprawną datę i godzinę." };
  }

  const start = wallDate(date, parseMinutes(time));
  const check = await isSlotBookable({
    workshopId: booking.workshopId,
    serviceId: booking.serviceId,
    start,
    ignoreLeadTime: true,
    excludeBookingId: booking.id,
  });
  // najczęstszy przypadek: podpowiedzi policzone przy renderowaniu strony
  // zdążyły się zdezaktualizować, bo ktoś zajął ten slot w międzyczasie
  if (!check.ok) return { error: check.reason };

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: "PROPOSED",
      originalStartAt: booking.originalStartAt ?? booking.startAt,
      startAt: start,
      endAt: addMinutes(start, booking.service.durationMin),
      workshopNote: note || null,
    },
  });

  await sendMail({
    to: booking.customerEmail,
    subject: `Propozycja innego terminu — ${booking.workshop.name}`,
    text: [
      `Warsztat nie może przyjąć Cię o ${fmtDateTime(booking.startAt)} i proponuje inny termin:`,
      "",
      `Nowy termin: ${fmtDateTime(start)}`,
      note ? `Komentarz: ${note}` : "",
      "",
      `Potwierdź lub odrzuć propozycję: ${manageLink(booking.workshop.slug, booking.manageToken)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  revalidatePath("/panel");
  revalidatePath("/panel/kalendarz");
  redirect("/panel");
}

export async function setBookingStatus(formData: FormData) {
  const booking = await loadOwnBooking(String(formData.get("id") || ""));
  const status = String(formData.get("status") || "");
  if (!["DONE", "CANCELLED", "CONFIRMED"].includes(status)) {
    throw new Error("Nieprawidłowy status.");
  }

  await db.booking.update({
    where: { id: booking.id },
    data: { status: status as "DONE" | "CANCELLED" | "CONFIRMED" },
  });

  if (status === "CANCELLED") {
    await sendMail({
      to: booking.customerEmail,
      subject: `Wizyta odwołana — ${booking.workshop.name}`,
      text: [
        `Warsztat musiał odwołać wizytę zaplanowaną na ${fmtDateTime(booking.startAt)}.`,
        booking.workshop.phone ? `Kontakt: ${booking.workshop.phone}` : "",
        "",
        `Nowy termin możesz wybrać tutaj: ${appUrl(`/w/${booking.workshop.slug}`)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  revalidatePath("/panel");
  revalidatePath("/panel/kalendarz");
}

/* ---------------- wizyta wpisana ręcznie ---------------- */

/**
 * Wizyta umówiona przez telefon albo przy ladzie.
 *
 * Powstaje od razu jako potwierdzona — warsztat nie musi akceptować własnego wpisu.
 * Oznaczamy ją jako PHONE, żeby było widać, ile ruchu naprawdę przechodzi przez
 * internet, a ile nadal przez słuchawkę. Bez tego ekranu kalendarz kłamie: pokazuje
 * wolne stanowisko, na którym już stoi auto.
 */
export async function createManualBooking(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const workshop = await requireWorkshop();

  const serviceId = String(formData.get("serviceId") || "");
  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service || service.workshopId !== workshop.id) {
    return { error: "Wybierz usługę." };
  }

  const customerName = String(formData.get("customerName") || "").trim().slice(0, 120);
  const customerPhone = String(formData.get("customerPhone") || "").trim().slice(0, 32);
  const customerEmail = String(formData.get("customerEmail") || "").trim().slice(0, 160);
  const carModel = String(formData.get("carModel") || "").trim().slice(0, 120);
  const carPlate = String(formData.get("carPlate") || "").trim().slice(0, 20).toUpperCase();
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000);

  if (customerName.length < 3) return { error: "Podaj imię i nazwisko klienta." };
  if (!/^[0-9+\s()-]{9,}$/.test(customerPhone)) return { error: "Podaj poprawny numer telefonu." };
  if (customerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
    return { error: "Podaj poprawny adres e-mail albo zostaw pole puste." };
  }
  if (!carModel) return { error: "Podaj markę i model auta." };

  // termin: albo kliknięty slot z kalendarza, albo wpisany ręcznie
  const slot = String(formData.get("start") || "");
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const override = formData.get("override") === "on";

  let start: Date;
  if (slot) {
    start = new Date(slot);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)) {
    start = wallDate(date, parseMinutes(time));
  } else {
    return { error: "Wybierz termin wizyty." };
  }
  if (Number.isNaN(start.getTime())) return { error: "Nieprawidłowy termin." };

  // Przy zaznaczonym „wpisz mimo zajętości” świadomie pomijamy kontrolę pojemności —
  // warsztat wie o swoim podnośniku więcej niż nasz kalendarz.
  if (!override) {
    const check = await isSlotBookable({
      workshopId: workshop.id,
      serviceId,
      start,
      ignoreLeadTime: true,
    });
    if (!check.ok) return { error: check.reason };
  }

  const booking = await db.booking.create({
    data: {
      workshopId: workshop.id,
      serviceId,
      startAt: start,
      endAt: addMinutes(start, service.durationMin),
      status: "CONFIRMED",
      source: "PHONE",
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      carModel,
      carPlate: carPlate || null,
      notes: notes || null,
      manageToken: newToken(),
    },
  });

  if (formData.get("notify") === "on" && customerEmail) {
    await sendMail({
      to: customerEmail,
      subject: `Potwierdzenie wizyty — ${workshop.name}`,
      text: [
        `Potwierdzamy umówioną wizytę.`,
        "",
        `Usługa: ${service.name}`,
        `Termin: ${fmtDateTime(start)}`,
        workshop.address ? `Adres:  ${workshop.address}` : "",
        "",
        `Dodaj do kalendarza: ${manageLink(workshop.slug, booking.manageToken)}/kalendarz.ics`,
        `Status wizyty i możliwość odwołania: ${manageLink(workshop.slug, booking.manageToken)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  revalidatePath("/panel");
  revalidatePath("/panel/kalendarz");
  redirect(`/panel/kalendarz?view=dzien&date=${dateKey(start)}`);
}

/* ---------------- edycja istniejącej wizyty ---------------- */

/**
 * Przesunięcie wizyty, zmiana usługi albo poprawka danych klienta.
 *
 * Osobna ścieżka od „zaproponuj inny termin”: tam pytamy klienta o zgodę, tutaj
 * warsztat po prostu poprawia własny wpis — bo pomylił godzinę albo klient
 * zadzwonił, że przyjedzie dwie godziny później.
 */
export async function updateBooking(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const booking = await loadOwnBooking(String(formData.get("id") || ""));

  const serviceId = String(formData.get("serviceId") || "");
  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service || service.workshopId !== booking.workshopId) {
    return { error: "Wybierz usługę." };
  }

  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { error: "Podaj poprawną datę i godzinę." };
  }

  const customerName = String(formData.get("customerName") || "").trim().slice(0, 120);
  const customerPhone = String(formData.get("customerPhone") || "").trim().slice(0, 32);
  const customerEmail = String(formData.get("customerEmail") || "").trim().slice(0, 160);
  const carModel = String(formData.get("carModel") || "").trim().slice(0, 120);
  const carPlate = String(formData.get("carPlate") || "").trim().slice(0, 20).toUpperCase();
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000);

  if (customerName.length < 3) return { error: "Podaj imię i nazwisko klienta." };
  if (!/^[0-9+\s()-]{9,}$/.test(customerPhone)) return { error: "Podaj poprawny numer telefonu." };
  if (customerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
    return { error: "Podaj poprawny adres e-mail albo zostaw pole puste." };
  }
  if (!carModel) return { error: "Podaj markę i model auta." };

  const start = wallDate(date, parseMinutes(time));
  const override = formData.get("override") === "on";

  if (!override) {
    const check = await isSlotBookable({
      workshopId: booking.workshopId,
      serviceId,
      start,
      ignoreLeadTime: true,
      excludeBookingId: booking.id,
    });
    if (!check.ok) return { error: check.reason };
  }

  const timeChanged = start.getTime() !== booking.startAt.getTime();
  const serviceChanged = serviceId !== booking.serviceId;

  await db.booking.update({
    where: { id: booking.id },
    data: {
      serviceId,
      startAt: start,
      endAt: addMinutes(start, service.durationMin),
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      carModel,
      carPlate: carPlate || null,
      notes: notes || null,
    },
  });

  if (formData.get("notify") === "on" && customerEmail && (timeChanged || serviceChanged)) {
    await sendMail({
      to: customerEmail,
      subject: `Zmiana terminu wizyty — ${booking.workshop.name}`,
      text: [
        `Twoja wizyta w ${booking.workshop.name} została zaktualizowana.`,
        "",
        `Usługa: ${service.name}`,
        `Nowy termin: ${fmtDateTime(start)}`,
        timeChanged ? `Poprzedni termin: ${fmtDateTime(booking.startAt)}` : "",
        "",
        `Dodaj do kalendarza: ${manageLink(booking.workshop.slug, booking.manageToken)}/kalendarz.ics`,
        `Szczegóły i odwołanie: ${manageLink(booking.workshop.slug, booking.manageToken)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  revalidatePath("/panel");
  revalidatePath("/panel/kalendarz");
  revalidatePath(`/panel/rezerwacja/${booking.id}`);
  return { saved: true };
}

/* ---------------- RODO ---------------- */

/** Realizacja żądania usunięcia danych klienta (art. 17 RODO). */
export async function anonymizeCustomerData(formData: FormData) {
  const workshop = await requireWorkshop();
  const phone = String(formData.get("phone") || "").trim();
  if (!phone) throw new Error("Brak numeru telefonu.");

  await anonymizeCustomer(workshop.id, phone);

  revalidatePath("/panel/klienci");
  revalidatePath("/panel");
}

/* ---------------- ustawienia ---------------- */

export async function saveWorkshop(formData: FormData) {
  const workshop = await requireWorkshop();

  const bays = Math.max(1, Math.min(20, Number(formData.get("bays") || 1)));
  const slotStepMin = Math.max(5, Math.min(240, Number(formData.get("slotStepMin") || 30)));
  const leadTimeHours = Math.max(0, Math.min(168, Number(formData.get("leadTimeHours") || 2)));
  const maxAdvanceDays = Math.max(1, Math.min(365, Number(formData.get("maxAdvanceDays") || 60)));

  await db.workshop.update({
    where: { id: workshop.id },
    data: {
      name: String(formData.get("name") || workshop.name).trim().slice(0, 120),
      phone: String(formData.get("phone") || "").trim().slice(0, 40) || null,
      email: String(formData.get("email") || "").trim().slice(0, 160) || null,
      address: String(formData.get("address") || "").trim().slice(0, 200) || null,
      bays,
      slotStepMin,
      leadTimeHours,
      maxAdvanceDays,
      retentionMonths: Math.max(3, Math.min(120, Number(formData.get("retentionMonths") || 24))),
      remindersEnabled: formData.get("remindersEnabled") === "on",
      smsEnabled: formData.get("smsEnabled") === "on",
      reminderHoursBefore: Math.max(
        1,
        Math.min(168, Number(formData.get("reminderHoursBefore") || 24)),
      ),
    },
  });

  revalidatePath("/panel/ustawienia");
}

export async function saveWorkingHours(formData: FormData) {
  const workshop = await requireWorkshop();

  for (let weekday = 0; weekday < 7; weekday++) {
    const isClosed = formData.get(`closed-${weekday}`) === "on";
    const open = String(formData.get(`open-${weekday}`) || "08:00");
    const close = String(formData.get(`close-${weekday}`) || "17:00");
    const openMin = parseMinutes(open);
    const closeMin = parseMinutes(close);

    await db.workingHours.upsert({
      where: { workshopId_weekday: { workshopId: workshop.id, weekday } },
      create: {
        workshopId: workshop.id,
        weekday,
        openMin,
        closeMin: Math.max(closeMin, openMin),
        isClosed,
      },
      update: { openMin, closeMin: Math.max(closeMin, openMin), isClosed },
    });
  }

  revalidatePath("/panel/ustawienia");
  revalidatePath("/panel/kalendarz");
}

export async function saveService(formData: FormData) {
  const workshop = await requireWorkshop();
  const id = String(formData.get("id") || "");

  const data = {
    name: String(formData.get("name") || "").trim().slice(0, 120),
    description: String(formData.get("description") || "").trim().slice(0, 300) || null,
    durationMin: Math.max(15, Math.min(1440, Number(formData.get("durationMin") || 60))),
    priceFrom: formData.get("priceFrom") ? Number(formData.get("priceFrom")) : null,
    active: formData.get("active") === "on",
  };

  if (!data.name) throw new Error("Nazwa usługi jest wymagana.");

  if (id) {
    const existing = await db.service.findUnique({ where: { id } });
    if (!existing || existing.workshopId !== workshop.id) throw new Error("Nie znaleziono usługi.");
    await db.service.update({ where: { id }, data });
  } else {
    const count = await db.service.count({ where: { workshopId: workshop.id } });
    await db.service.create({
      data: { ...data, workshopId: workshop.id, sortOrder: count },
    });
  }

  revalidatePath("/panel/ustawienia");
}

export async function deleteService(formData: FormData) {
  const workshop = await requireWorkshop();
  const id = String(formData.get("id") || "");

  const service = await db.service.findUnique({
    where: { id },
    include: { _count: { select: { bookings: true } } },
  });
  if (!service || service.workshopId !== workshop.id) throw new Error("Nie znaleziono usługi.");

  // usługi z historią wizyt tylko dezaktywujemy - inaczej stracilibyśmy historię klienta
  if (service._count.bookings > 0) {
    await db.service.update({ where: { id }, data: { active: false } });
  } else {
    await db.service.delete({ where: { id } });
  }

  revalidatePath("/panel/ustawienia");
}

export async function addTimeOff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const workshop = await requireWorkshop();
  const date = String(formData.get("date") || "");
  const from = String(formData.get("from") || "00:00");
  const to = String(formData.get("to") || "23:59");
  const reason = String(formData.get("reason") || "").trim().slice(0, 160);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Podaj poprawną datę." };

  const startAt = wallDate(date, parseMinutes(from));
  const endAt = wallDate(date, parseMinutes(to));
  if (endAt <= startAt) {
    return { error: "Godzina końca musi być późniejsza niż początek." };
  }

  await db.timeOff.create({
    data: { workshopId: workshop.id, startAt, endAt, reason: reason || null },
  });

  revalidatePath("/panel/ustawienia");
  revalidatePath("/panel/kalendarz");
  return { saved: true };
}

export async function deleteTimeOff(formData: FormData) {
  const workshop = await requireWorkshop();
  const id = String(formData.get("id") || "");
  const entry = await db.timeOff.findUnique({ where: { id } });
  if (!entry || entry.workshopId !== workshop.id) return;

  await db.timeOff.delete({ where: { id } });
  revalidatePath("/panel/ustawienia");
  revalidatePath("/panel/kalendarz");
}
