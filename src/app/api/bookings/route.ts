import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSlotBookable } from "@/lib/availability";
import { newToken } from "@/lib/auth";
import { appUrl, sendMail } from "@/lib/notify";
import { fmtDateTime, nowWall } from "@/lib/time";
import { isBookingEnabled } from "@/lib/subscription";
import {
  HONEYPOT_FIELD,
  checkRateLimits,
  clientIp,
  hashIp,
  looksLikeSpam,
  verifyFormToken,
} from "@/lib/antispam";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  // 1. pułapka na boty — człowiek tego pola nie widzi, więc nigdy go nie wypełni
  if (clean(body[HONEYPOT_FIELD], 200) !== "") {
    return NextResponse.json({ error: "Nie udało się wysłać zgłoszenia." }, { status: 400 });
  }

  // 2. podpisany znacznik czasu — chroni przed wysyłką skryptem i przed odgrzaniem starej strony
  const formCheck = verifyFormToken(clean(body.formToken, 120));
  if (!formCheck.ok) {
    return NextResponse.json({ error: formCheck.reason }, { status: 400 });
  }

  const slug = clean(body.slug, 80);
  const serviceId = clean(body.serviceId, 40);
  const startRaw = clean(body.start, 40);

  const customerName = clean(body.customerName, 120);
  const customerPhone = clean(body.customerPhone, 32);
  const customerEmail = clean(body.customerEmail, 160);
  const carModel = clean(body.carModel, 120);
  const carPlate = clean(body.carPlate, 20).toUpperCase();
  const notes = clean(body.notes, 1000);

  if (!customerName || customerName.length < 3) {
    return NextResponse.json({ error: "Podaj imię i nazwisko." }, { status: 400 });
  }
  if (!/^[0-9+\s()-]{9,}$/.test(customerPhone)) {
    return NextResponse.json({ error: "Podaj poprawny numer telefonu." }, { status: 400 });
  }
  if (customerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
    return NextResponse.json({ error: "Podaj poprawny adres e-mail." }, { status: 400 });
  }
  if (!carModel) {
    return NextResponse.json({ error: "Podaj markę i model auta." }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json(
      { error: "Aby wysłać zgłoszenie, potwierdź zapoznanie się z informacją o danych." },
      { status: 400 },
    );
  }
  if (looksLikeSpam(`${notes} ${customerName} ${carModel}`)) {
    return NextResponse.json({ error: "Zgłoszenie zawiera niedozwoloną treść." }, { status: 400 });
  }

  const workshop = await db.workshop.findUnique({ where: { slug } });
  if (!workshop) {
    return NextResponse.json({ error: "Nie znaleziono warsztatu." }, { status: 404 });
  }
  if (!isBookingEnabled(workshop)) {
    return NextResponse.json(
      { error: "Rezerwacja online jest chwilowo niedostępna. Prosimy o kontakt telefoniczny." },
      { status: 403 },
    );
  }

  // 3. limity ilościowe — po numerze telefonu i po skrócie adresu IP
  const ipHash = hashIp(clientIp(req.headers));
  const limits = await checkRateLimits({
    workshopId: workshop.id,
    phone: customerPhone,
    ipHash,
    now: nowWall(),
  });
  if (!limits.ok) {
    return NextResponse.json({ error: limits.reason }, { status: 429 });
  }

  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Wybierz termin wizyty." }, { status: 400 });
  }

  const check = await isSlotBookable({ workshopId: workshop.id, serviceId, start });
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 409 });
  }

  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) {
    return NextResponse.json({ error: "Ta usługa jest niedostępna." }, { status: 400 });
  }

  const booking = await db.booking.create({
    data: {
      workshopId: workshop.id,
      serviceId,
      startAt: start,
      endAt: check.end,
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      carModel,
      carPlate: carPlate || null,
      notes: notes || null,
      source: "ONLINE",
      consentAt: nowWall(),
      ipHash,
      manageToken: newToken(),
    },
  });

  const manageLink = appUrl(`/w/${workshop.slug}/rezerwacja/${booking.manageToken}`);

  // powiadomienie dla warsztatu
  await sendMail({
    to: workshop.email,
    subject: `Nowe zgłoszenie: ${service.name} — ${fmtDateTime(start)}`,
    text: [
      `Nowe zgłoszenie rezerwacji w ${workshop.name}.`,
      "",
      `Usługa:  ${service.name}`,
      `Termin:  ${fmtDateTime(start)}`,
      `Klient:  ${customerName}, tel. ${customerPhone}`,
      `Auto:    ${carModel}${carPlate ? ` (${carPlate})` : ""}`,
      notes ? `Uwagi:   ${notes}` : "",
      "",
      `Zaakceptuj lub zaproponuj inny termin: ${appUrl("/panel")}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  // potwierdzenie przyjęcia zgłoszenia dla klienta
  await sendMail({
    to: customerEmail || null,
    subject: `Otrzymaliśmy Twoje zgłoszenie — ${workshop.name}`,
    text: [
      `Dziękujemy, zgłoszenie zostało przyjęte i czeka na potwierdzenie przez warsztat.`,
      "",
      `Usługa: ${service.name}`,
      `Proponowany termin: ${fmtDateTime(start)}`,
      "",
      `Status rezerwacji i możliwość odwołania: ${manageLink}`,
    ].join("\n"),
  });

  return NextResponse.json({ token: booking.manageToken });
}
