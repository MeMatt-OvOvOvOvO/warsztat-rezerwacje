import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { WORKSHOPS } from "./demo-data";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/** Czas ścienny warsztatu zapisany w polach UTC - zgodnie z src/lib/time.ts */
function wall(key: string, minutes: number): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + minutes * 60_000);
}

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shift(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  const today = todayKey();

  // czyścimy tylko warsztaty demonstracyjne — realnych danych nie ruszamy
  await db.workshop.deleteMany({ where: { slug: { in: WORKSHOPS.map((w) => w.slug) } } });

  for (const w of WORKSHOPS) {
    const workshop = await db.workshop.create({
      data: {
        slug: w.slug,
        name: w.name,
        phone: w.phone,
        email: w.email,
        address: w.address,
        passwordHash: hashPassword(w.password),
        bays: w.bays,
        slotStepMin: w.slotStepMin,
        leadTimeHours: w.leadTimeHours,
        maxAdvanceDays: w.maxAdvanceDays,
        subscriptionStatus: w.subscriptionStatus,
        subscriptionUntil: wall(shift(today, w.subscriptionInDays), 0),
        monthlyPricePln: w.monthlyPricePln,
        adminNote: w.adminNote,
        remindersEnabled: w.remindersEnabled,
        reminderHoursBefore: w.reminderHoursBefore,
        smsEnabled: w.smsEnabled,
      },
    });

    const services = [];
    for (const [i, s] of w.services.entries()) {
      services.push(
        await db.service.create({
          data: {
            workshopId: workshop.id,
            name: s.name,
            description: s.description,
            durationMin: s.durationMin,
            priceFrom: s.priceFrom,
            active: s.active ?? true,
            sortOrder: i,
          },
        }),
      );
    }

    // 0 = poniedziałek ... 5 = sobota, 6 = niedziela
    for (let weekday = 0; weekday < 7; weekday++) {
      const isSat = weekday === 5;
      await db.workingHours.create({
        data: {
          workshopId: workshop.id,
          weekday,
          openMin: isSat ? w.hours.satOpen : w.hours.weekdayOpen,
          closeMin: isSat ? w.hours.satClose : w.hours.weekdayClose,
          isClosed: weekday === 6 || (isSat && w.hours.satClosed),
        },
      });
    }

    for (const b of w.bookings) {
      const service = services[b.service];
      const start = wall(shift(today, b.dayOffset), b.minutes);
      const source = b.source ?? "ONLINE";

      await db.booking.create({
        data: {
          workshopId: workshop.id,
          serviceId: service.id,
          startAt: start,
          endAt: new Date(start.getTime() + service.durationMin * 60_000),
          originalStartAt:
            b.originalMinutes === undefined
              ? null
              : wall(shift(today, b.dayOffset), b.originalMinutes),
          status: b.status,
          customerName: b.customerName,
          customerPhone: b.customerPhone,
          customerEmail: b.customerEmail,
          carModel: b.carModel,
          carPlate: b.carPlate,
          notes: b.notes ?? null,
          workshopNote: b.workshopNote ?? null,
          source,
          consentAt: source === "ONLINE" ? new Date() : null,
          manageToken: randomBytes(18).toString("hex"),
        },
      });
    }
  }

  const totalBookings = WORKSHOPS.reduce((sum, w) => sum + w.bookings.length, 0);

  console.log("");
  console.log(`  Dane demonstracyjne gotowe: ${WORKSHOPS.length} warsztaty, ${totalBookings} rezerwacji.`);
  console.log("  ─────────────────────────────────────────────────────────────");
  for (const w of WORKSHOPS) {
    const status =
      w.subscriptionStatus === "SUSPENDED"
        ? "wstrzymany — rezerwacje wyłączone"
        : w.subscriptionStatus === "TRIAL"
          ? "okres próbny"
          : "abonament aktywny";
    console.log(`  ${w.name}`);
    console.log(`    strona:  http://localhost:3000/w/${w.slug}`);
    console.log(`    login:   ${w.slug}  /  hasło: ${w.password}`);
    console.log(`    profil:  ${w.bays} stanow., ${status}`);
    console.log("");
  }
  console.log("  Panel warsztatu:  http://localhost:3000/panel");
  console.log("  Panel operatora:  http://localhost:3000/admin");
  console.log("  Hasło operatora z ADMIN_PASSWORD w .env (domyślnie: admin1234)");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
