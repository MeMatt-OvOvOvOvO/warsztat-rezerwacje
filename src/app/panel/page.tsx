import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkshopOrRedirect } from "@/lib/auth";
import { acceptBooking, rejectBooking, setBookingStatus } from "@/app/actions/panel";
import { fmtDateTime, fmtDuration, fmtTime, nowWall } from "@/lib/time";
import { STATUS_LABEL, statusClass, type BookingStatusValue } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function PanelHome() {
  const workshop = await requireWorkshopOrRedirect();
  const now = nowWall();

  const [pending, proposed, upcoming] = await Promise.all([
    db.booking.findMany({
      where: { workshopId: workshop.id, status: "PENDING" },
      include: { service: true },
      orderBy: { startAt: "asc" },
    }),
    db.booking.findMany({
      where: { workshopId: workshop.id, status: "PROPOSED" },
      include: { service: true },
      orderBy: { startAt: "asc" },
    }),
    db.booking.findMany({
      where: { workshopId: workshop.id, status: "CONFIRMED", endAt: { gte: now } },
      include: { service: true },
      orderBy: { startAt: "asc" },
      take: 8,
    }),
  ]);

  return (
    <main>
      <div className="row-between mb">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h1>Zgłoszenia</h1>
          <p>Nowe rezerwacje czekające na Twoją decyzję i najbliższe potwierdzone wizyty.</p>
        </div>
        <div className="toolbar">
          <Link className="btn btn-primary" href="/panel/nowa-wizyta">
            + Wizyta z telefonu
          </Link>
          <Link className="btn btn-sm" href={`/w/${workshop.slug}`} target="_blank">
            Zobacz stronę rezerwacji ↗
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb">Czekają na decyzję ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="card">
            <div className="empty">Brak nowych zgłoszeń. Wszystko obsłużone.</div>
          </div>
        ) : (
          <div className="stack">
            {pending.map((b) => (
              <div className="card" key={b.id}>
                <div className="row-between">
                  <div>
                    <h3 style={{ margin: 0 }}>
                      {b.service.name}{" "}
                      <span className="muted small">({fmtDuration(b.service.durationMin)})</span>
                    </h3>
                    <div style={{ fontWeight: 600 }}>
                      {fmtDateTime(b.startAt)} – {fmtTime(b.endAt)}
                    </div>
                  </div>
                  <span className={statusClass(b.status)}>{STATUS_LABEL[b.status as BookingStatusValue]}</span>
                </div>

                <table className="kv mt">
                  <tbody>
                    <tr>
                      <td>Klient</td>
                      <td>
                        {b.customerName} · <a href={`tel:${b.customerPhone}`}>{b.customerPhone}</a>
                        {b.customerEmail ? ` · ${b.customerEmail}` : ""}
                      </td>
                    </tr>
                    <tr>
                      <td>Auto</td>
                      <td>
                        {b.carModel}
                        {b.carPlate ? ` (${b.carPlate})` : ""}
                      </td>
                    </tr>
                    {b.notes && (
                      <tr>
                        <td>Uwagi</td>
                        <td>{b.notes}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="row mt">
                  <form action={acceptBooking}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="btn btn-ok" type="submit">
                      Akceptuj
                    </button>
                  </form>
                  <Link className="btn" href={`/panel/rezerwacja/${b.id}`}>
                    Zaproponuj inny termin
                  </Link>
                  <details className="spacer">
                    <summary>Odrzuć</summary>
                    <form action={rejectBooking} className="mt" style={{ minWidth: 280 }}>
                      <input type="hidden" name="id" value={b.id} />
                      <input
                        name="note"
                        type="text"
                        placeholder="Powód (trafi do klienta, opcjonalny)"
                      />
                      <button className="btn btn-danger btn-sm mt" type="submit">
                        Potwierdź odrzucenie
                      </button>
                    </form>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {proposed.length > 0 && (
        <section className="mt">
          <h2>Czekają na odpowiedź klienta ({proposed.length})</h2>
          <div className="card">
            <table>
              <tbody>
                {proposed.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{fmtDateTime(b.startAt)}</strong>
                      <div className="muted small">
                        {b.service.name} · {b.customerName} · {b.customerPhone}
                      </div>
                      {b.originalStartAt && (
                        <div className="muted small">
                          pierwotnie: {fmtDateTime(b.originalStartAt)}
                        </div>
                      )}
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
          </div>
        </section>
      )}

      <section className="mt">
        <h2>Najbliższe potwierdzone wizyty</h2>
        <div className="card">
          {upcoming.length === 0 ? (
            <div className="empty">Brak zaplanowanych wizyt.</div>
          ) : (
            <table>
              <tbody>
                {upcoming.map((b) => (
                  <tr key={b.id}>
                    <td style={{ width: 260 }}>
                      <strong>{fmtDateTime(b.startAt)}</strong>
                      <div className="muted small">{fmtTime(b.startAt)} – {fmtTime(b.endAt)}</div>
                    </td>
                    <td>
                      {b.service.name}
                      <div className="muted small">
                        {b.customerName} · {b.carModel}
                        {b.carPlate ? ` (${b.carPlate})` : ""}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {b.endAt.getTime() < now.getTime() && (
                        <form action={setBookingStatus} style={{ display: "inline-block" }}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="status" value="DONE" />
                          <button className="btn btn-sm" type="submit">
                            Zrealizowana
                          </button>
                        </form>
                      )}{" "}
                      <Link className="btn btn-sm" href={`/panel/rezerwacja/${b.id}`}>
                        Szczegóły
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
