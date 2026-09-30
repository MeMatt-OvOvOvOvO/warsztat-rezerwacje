"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createAdminSession,
  destroyAdminSession,
  requireAdmin,
  verifyAdminPassword,
} from "@/lib/admin";
import { createSession, destroySession, hashPassword } from "@/lib/auth";
import { DEFAULT_SERVICES, defaultWorkingHours, generatePassword, slugify } from "@/lib/defaults";
import { addDays, dateKey, nowWall, wallDate } from "@/lib/time";

/** Wynik akcji formularza — patrz komentarz przy ActionState w actions/panel.ts. */
export type AdminActionState = { error?: string; saved?: boolean };

/* ---------------- logowanie operatora ---------------- */

export async function adminLogin(formData: FormData) {
  const password = String(formData.get("password") || "");
  if (!verifyAdminPassword(password)) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession();
  redirect("/admin");
}

export async function adminLogout() {
  await destroyAdminSession();
  redirect("/admin/login");
}

/* ---------------- wejście do panelu warsztatu ---------------- */

/**
 * Podgląd panelu warsztatu bez pytania właściciela o hasło.
 *
 * Ustawia zwykłą sesję warsztatu, ale ciasteczko operatora zostaje — panel wykrywa
 * je i wyświetla pasek „jesteś w trybie operatora”. Bez tego paska łatwo zapomnieć,
 * czyje dane się właśnie ogląda, a to dane osobowe klientów cudzego warsztatu.
 *
 * Docelowo warto dopisać rejestr wejść: kto, kiedy, do którego warsztatu.
 */
export async function impersonateWorkshop(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const workshop = await db.workshop.findUnique({ where: { id } });
  if (!workshop) throw new Error("Nie znaleziono warsztatu.");

  await createSession(workshop.id);
  redirect("/panel");
}

/** Wyjście z podglądu: kasujemy sesję warsztatu, sesja operatora zostaje. */
export async function endImpersonation() {
  await destroySession();
  redirect("/admin");
}

/* ---------------- pomocnicze ---------------- */

function text(formData: FormData, key: string, max = 200): string {
  return String(formData.get(key) || "").trim().slice(0, max);
}

function int(formData: FormData, key: string, fallback: number, min: number, max: number): number {
  const raw = Number(formData.get(key));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

/** Dokłada -2, -3… gdy adres jest już zajęty. */
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "warsztat";
  let candidate = root;
  let n = 1;
  while (await db.workshop.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

/* ---------------- zakładanie warsztatu ---------------- */

export async function createWorkshop(formData: FormData) {
  await requireAdmin();

  const name = text(formData, "name", 120);
  if (name.length < 3) throw new Error("Podaj nazwę warsztatu.");

  const requestedSlug = slugify(text(formData, "slug", 60) || name);
  const slug = await uniqueSlug(requestedSlug);

  const password = text(formData, "password", 60) || generatePassword();
  const trialDays = int(formData, "trialDays", 30, 0, 365);
  const withDefaults = formData.get("withDefaults") === "on";

  const workshop = await db.workshop.create({
    data: {
      slug,
      name,
      email: text(formData, "email", 160) || null,
      phone: text(formData, "phone", 40) || null,
      address: text(formData, "address", 200) || null,
      passwordHash: hashPassword(password),
      bays: int(formData, "bays", 1, 1, 20),
      slotStepMin: int(formData, "slotStepMin", 30, 5, 240),
      leadTimeHours: int(formData, "leadTimeHours", 2, 0, 168),
      maxAdvanceDays: int(formData, "maxAdvanceDays", 60, 1, 365),
      monthlyPricePln: int(formData, "monthlyPricePln", 150, 0, 10_000),
      subscriptionStatus: trialDays > 0 ? "TRIAL" : "ACTIVE",
      subscriptionUntil: wallDate(addDays(dateKey(nowWall()), trialDays || 30)),
      adminNote: text(formData, "adminNote", 500) || null,
    },
  });

  await db.workingHours.createMany({
    data: defaultWorkingHours().map((h) => ({ ...h, workshopId: workshop.id })),
  });

  if (withDefaults) {
    await db.service.createMany({
      data: DEFAULT_SERVICES.map((s, i) => ({ ...s, workshopId: workshop.id, sortOrder: i })),
    });
  }

  revalidatePath("/admin");
  // hasło pokazujemy raz, na stronie warsztatu — potem znika i da się je tylko zresetować
  redirect(`/admin/warsztat/${workshop.id}?haslo=${encodeURIComponent(password)}&nowy=1`);
}

/* ---------------- edycja ---------------- */

async function loadWorkshop(id: string) {
  const workshop = await db.workshop.findUnique({ where: { id } });
  if (!workshop) throw new Error("Nie znaleziono warsztatu.");
  return workshop;
}

export async function updateWorkshop(formData: FormData) {
  await requireAdmin();
  const workshop = await loadWorkshop(text(formData, "id", 40));

  const requestedSlug = slugify(text(formData, "slug", 60) || workshop.name);
  const slug = requestedSlug === workshop.slug ? workshop.slug : await uniqueSlug(requestedSlug);

  await db.workshop.update({
    where: { id: workshop.id },
    data: {
      name: text(formData, "name", 120) || workshop.name,
      slug,
      email: text(formData, "email", 160) || null,
      phone: text(formData, "phone", 40) || null,
      address: text(formData, "address", 200) || null,
      bays: int(formData, "bays", workshop.bays, 1, 20),
      adminNote: text(formData, "adminNote", 500) || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/warsztat/${workshop.id}`);
}

export async function setSubscription(formData: FormData) {
  await requireAdmin();
  const workshop = await loadWorkshop(text(formData, "id", 40));

  const status = text(formData, "subscriptionStatus", 20);
  if (!["TRIAL", "ACTIVE", "SUSPENDED"].includes(status)) {
    throw new Error("Nieprawidłowy status abonamentu.");
  }

  const until = text(formData, "subscriptionUntil", 10);

  await db.workshop.update({
    where: { id: workshop.id },
    data: {
      subscriptionStatus: status,
      subscriptionUntil: /^\d{4}-\d{2}-\d{2}$/.test(until) ? wallDate(until) : null,
      monthlyPricePln: int(formData, "monthlyPricePln", workshop.monthlyPricePln, 0, 10_000),
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/warsztat/${workshop.id}`);
}

/** „Opłacone na kolejny miesiąc” jednym kliknięciem. */
export async function extendSubscription(formData: FormData) {
  await requireAdmin();
  const workshop = await loadWorkshop(text(formData, "id", 40));
  const days = int(formData, "days", 30, 1, 400);

  const today = dateKey(nowWall());
  // liczymy od dzisiaj albo od końca bieżącego okresu, jeśli jeszcze trwa
  const base =
    workshop.subscriptionUntil && workshop.subscriptionUntil.getTime() > nowWall().getTime()
      ? dateKey(workshop.subscriptionUntil)
      : today;

  await db.workshop.update({
    where: { id: workshop.id },
    data: {
      subscriptionStatus: "ACTIVE",
      subscriptionUntil: wallDate(addDays(base, days)),
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/warsztat/${workshop.id}`);
}

export async function resetWorkshopPassword(formData: FormData) {
  await requireAdmin();
  const workshop = await loadWorkshop(text(formData, "id", 40));

  const password = generatePassword();
  await db.workshop.update({
    where: { id: workshop.id },
    data: { passwordHash: hashPassword(password) },
  });

  redirect(`/admin/warsztat/${workshop.id}?haslo=${encodeURIComponent(password)}`);
}

export async function deleteWorkshop(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const workshop = await loadWorkshop(text(formData, "id", 40));

  // kasowanie ciągnie za sobą wszystkie rezerwacje, więc wymagamy przepisania adresu
  if (text(formData, "confirm", 80) !== workshop.slug) {
    return { error: `Wpisany tekst nie zgadza się z adresem „${workshop.slug}”. Nic nie usunąłem.` };
  }

  await db.workshop.delete({ where: { id: workshop.id } });

  revalidatePath("/admin");
  redirect("/admin");
}
