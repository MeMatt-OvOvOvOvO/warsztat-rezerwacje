import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dateKey, dayName, fmtMinutes, nowWall, weekdayOf } from "@/lib/time";
import { initials } from "@/lib/text";
import { isBookingEnabled } from "@/lib/subscription";
import { issueFormToken } from "@/lib/antispam";
import ThemeToggle from "@/app/ThemeToggle";
import BookingFlow from "./BookingFlow";

export const dynamic = "force-dynamic";

export default async function WorkshopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const workshop = await db.workshop.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      workingHours: { orderBy: { weekday: "asc" } },
    },
  });

  if (!workshop) notFound();

  const today = dateKey(nowWall());
  const todayWeekday = weekdayOf(today);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-mark">{initials(workshop.name)}</span>
            {workshop.name}
          </span>
          <div className="row spacer">
            {workshop.phone && (
              <a className="small" href={`tel:${workshop.phone}`}>
                {workshop.phone}
              </a>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="page">
        <div className="section-head">
          <h1>Umów wizytę online</h1>
          <p>
            Wybierz usługę i termin — zgłoszenie trafi bezpośrednio do warsztatu. Potwierdzenie
            dostaniesz, gdy warsztat zaakceptuje termin.
          </p>
        </div>

        {!isBookingEnabled(workshop) ? (
          <div className="card">
            <div className="alert alert-info" style={{ marginBottom: 0 }}>
              Rezerwacja online jest chwilowo niedostępna.
              {workshop.phone ? ` Prosimy o kontakt telefoniczny: ${workshop.phone}.` : ""}
            </div>
          </div>
        ) : workshop.services.length === 0 ? (
          <div className="card">
            <div className="empty">Ten warsztat nie ma jeszcze skonfigurowanych usług.</div>
          </div>
        ) : (
          <BookingFlow
            slug={workshop.slug}
            today={today}
            formToken={issueFormToken()}
            services={workshop.services.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              durationMin: s.durationMin,
              priceFrom: s.priceFrom,
            }))}
          />
        )}

        <div className="card">
          <div className="section-head">
            <h2>Godziny otwarcia</h2>
            {workshop.address && <p>{workshop.address}</p>}
          </div>
          <table>
            <tbody>
              {workshop.workingHours.map((h) => (
                <tr key={h.weekday}>
                  <td
                    style={{
                      width: 160,
                      textTransform: "capitalize",
                      fontWeight: h.weekday === todayWeekday ? 620 : 400,
                    }}
                  >
                    {dayName(h.weekday)}
                    {h.weekday === todayWeekday && (
                      <span className="muted small" style={{ fontWeight: 400 }}>
                        {" "}
                        · dziś
                      </span>
                    )}
                  </td>
                  <td className={h.isClosed ? "muted" : undefined}>
                    {h.isClosed ? "nieczynne" : `${fmtMinutes(h.openMin)} – ${fmtMinutes(h.closeMin)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
