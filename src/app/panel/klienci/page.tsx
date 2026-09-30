import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkshopOrRedirect } from "@/lib/auth";
import { fmtDateTime, nowWall } from "@/lib/time";
import { STATUS_SHORT, statusClass, type BookingStatusValue } from "@/lib/status";
import { anonymizeCustomerData } from "@/app/actions/panel";
import { matchesQuery } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const workshop = await requireWorkshopOrRedirect();
  const { q } = await searchParams;
  const query = (q || "").trim();

  const all = await db.booking.findMany({
    where: { workshopId: workshop.id },
    include: { service: true },
    orderBy: { startAt: "desc" },
  });

  // filtrujemy w pamięci — patrz komentarz przy matchesQuery w src/lib/text.ts
  const bookings = all.filter((b) =>
    matchesQuery([b.customerName, b.customerPhone, b.carPlate, b.carModel], query),
  );

  const now = nowWall();

  type Customer = {
    phone: string;
    name: string;
    email: string | null;
    cars: Set<string>;
    visits: number;
    completed: number;
    lastVisit: Date | null;
    nextVisit: Date | null;
    recent: typeof bookings;
  };

  const byPhone = new Map<string, Customer>();

  for (const b of bookings) {
    let entry = byPhone.get(b.customerPhone);
    if (!entry) {
      entry = {
        phone: b.customerPhone,
        name: b.customerName,
        email: b.customerEmail,
        cars: new Set<string>(),
        visits: 0,
        completed: 0,
        lastVisit: null,
        nextVisit: null,
        recent: [],
      };
      byPhone.set(b.customerPhone, entry);
    }
    entry.cars.add(b.carPlate ? `${b.carModel} (${b.carPlate})` : b.carModel);
    entry.visits++;
    if (b.status === "DONE" || (b.status === "CONFIRMED" && b.endAt < now)) entry.completed++;
    if (b.endAt < now && (!entry.lastVisit || b.startAt > entry.lastVisit)) entry.lastVisit = b.startAt;
    if (
      b.startAt >= now &&
      ["PENDING", "PROPOSED", "CONFIRMED"].includes(b.status) &&
      (!entry.nextVisit || b.startAt < entry.nextVisit)
    ) {
      entry.nextVisit = b.startAt;
    }
    if (entry.recent.length < 6) entry.recent.push(b);
    if (!entry.email && b.customerEmail) entry.email = b.customerEmail;
  }

  const customers = [...byPhone.values()].sort((a, b) => b.visits - a.visits);

  return (
    <main>
      <div className="row-between mb">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h1>Klienci ({customers.length})</h1>
          <p>Historia zbudowana wokół numeru telefonu — bez zakładania kont przez klientów.</p>
        </div>
        <form className="search" method="get">
          <input name="q" type="search" defaultValue={query} placeholder="nazwisko, telefon, rejestracja" />
          <button className="btn btn-sm" type="submit">
            Szukaj
          </button>
          {query && (
            <Link className="btn btn-sm" href="/panel/klienci">
              Wyczyść
            </Link>
          )}
        </form>
      </div>

      {customers.length === 0 ? (
        <div className="card">
          <div className="empty">
            {query ? "Nic nie pasuje do wyszukiwania." : "Nie ma jeszcze żadnych rezerwacji."}
          </div>
        </div>
      ) : (
        <div className="stack">
          {customers.map((c) => (
            <div className="card" key={c.phone}>
              <div className="row-between">
                <div>
                  <h3 style={{ margin: 0 }}>{c.name}</h3>
                  <div className="muted small">
                    <a href={`tel:${c.phone}`}>{c.phone}</a>
                    {c.email ? ` · ${c.email}` : ""}
                  </div>
                  <div className="muted small">{[...c.cars].join(" · ")}</div>
                </div>
                <div className="stat">
                  <div>
                    wizyt: <strong>{c.visits}</strong> (zrealizowanych {c.completed})
                  </div>
                  {c.lastVisit && <div>ostatnia: {fmtDateTime(c.lastVisit)}</div>}
                  {c.nextVisit && <div>najbliższa: {fmtDateTime(c.nextVisit)}</div>}
                </div>
              </div>

              <details className="mt">
                <summary>Historia wizyt i dane osobowe</summary>
                <table className="mt">
                  <tbody>
                    {c.recent.map((b) => (
                      <tr key={b.id}>
                        <td style={{ width: 220 }}>{fmtDateTime(b.startAt)}</td>
                        <td>{b.service.name}</td>
                        <td>
                          <span className={statusClass(b.status)}>
                            {STATUS_SHORT[b.status as BookingStatusValue]}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link className="btn btn-sm" href={`/panel/rezerwacja/${b.id}`}>
                            Szczegóły
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <hr className="sep" />

                <div className="row-between">
                  <span className="muted small" style={{ maxWidth: "46ch" }}>
                    Na żądanie klienta (art. 17 RODO) możesz usunąć jego dane. Wizyty zostaną w
                    historii, ale bez imienia, telefonu i auta — licznik przychodu się nie zmieni.
                  </span>
                  <form action={anonymizeCustomerData}>
                    <input type="hidden" name="phone" value={c.phone} />
                    <button className="btn btn-sm btn-danger" type="submit">
                      Usuń dane tego klienta
                    </button>
                  </form>
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
