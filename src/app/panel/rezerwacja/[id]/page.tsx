import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkshopOrRedirect } from "@/lib/auth";
import { getAvailability } from "@/lib/availability";
import { acceptBooking, rejectBooking, setBookingStatus } from "@/app/actions/panel";
import { appUrl } from "@/lib/notify";
import { dateKey, fmtDateShort, fmtDateTime, fmtDuration, fmtTime, nowWall } from "@/lib/time";
import { STATUS_LABEL, statusClass, type BookingStatusValue } from "@/lib/status";
import EditBookingForm from "./EditBookingForm";
import ProposeTimeForm from "./ProposeTimeForm";

export const dynamic = "force-dynamic";

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const workshop = await requireWorkshopOrRedirect();
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: { service: true },
  });
  if (!booking || booking.workshopId !== workshop.id) notFound();

  const status = booking.status as BookingStatusValue;
  const now = nowWall();
  const from = dateKey(booking.startAt < now ? now : booking.startAt);

  const availability = await getAvailability({
    workshopId: workshop.id,
    serviceId: booking.serviceId,
    from,
    days: 14,
    ignoreLeadTime: true,
    excludeBookingId: booking.id,
  });

  const suggestions = availability
    .flatMap((day) => day.slots.map((slot) => ({ date: day.date, ...slot })))
    .filter((s) => new Date(s.start).getTime() > now.getTime())
    .slice(0, 12);

  const services = await db.service.findMany({
    where: { workshopId: workshop.id },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const history = await db.booking.findMany({
    where: { workshopId: workshop.id, customerPhone: booking.customerPhone, NOT: { id: booking.id } },
    include: { service: true },
    orderBy: { startAt: "desc" },
    take: 5,
  });

  return (
    <main>
      <p>
        <Link className="btn-link" href="/panel">
          ← Wróć do zgłoszeń
        </Link>
      </p>

      <div className="row-between mb">
        <h1 style={{ margin: 0 }}>{booking.service.name}</h1>
        <span className={statusClass(status)}>{STATUS_LABEL[status]}</span>
      </div>

      <div className="card">
        <table className="kv">
          <tbody>
            <tr>
              <td>Termin</td>
              <td>
                <strong>{fmtDateTime(booking.startAt)}</strong> – {fmtTime(booking.endAt)}{" "}
                <span className="muted">({fmtDuration(booking.service.durationMin)})</span>
              </td>
            </tr>
            {booking.originalStartAt && (
              <tr>
                <td>Pierwotny termin</td>
                <td>{fmtDateTime(booking.originalStartAt)}</td>
              </tr>
            )}
            <tr>
              <td>Klient</td>
              <td>
                {booking.customerName} · <a href={`tel:${booking.customerPhone}`}>{booking.customerPhone}</a>
                {booking.customerEmail ? ` · ${booking.customerEmail}` : ""}
              </td>
            </tr>
            <tr>
              <td>Auto</td>
              <td>
                {booking.carModel}
                {booking.carPlate ? ` (${booking.carPlate})` : ""}
              </td>
            </tr>
            {booking.notes && (
              <tr>
                <td>Uwagi klienta</td>
                <td>{booking.notes}</td>
              </tr>
            )}
            {booking.workshopNote && (
              <tr>
                <td>Notatka warsztatu</td>
                <td>{booking.workshopNote}</td>
              </tr>
            )}
            <tr>
              <td>Link dla klienta</td>
              <td className="mono" style={{ wordBreak: "break-all" }}>
                {appUrl(`/w/${workshop.slug}/rezerwacja/${booking.manageToken}`)}
              </td>
            </tr>
          </tbody>
        </table>

        <hr className="sep" />

        <div className="row">
          {(status === "PENDING" || status === "PROPOSED") && (
            <form action={acceptBooking}>
              <input type="hidden" name="id" value={booking.id} />
              <button className="btn btn-ok" type="submit">
                Potwierdź ten termin
              </button>
            </form>
          )}
          {status === "CONFIRMED" && booking.endAt.getTime() < now.getTime() && (
            <form action={setBookingStatus}>
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="status" value="DONE" />
              <button className="btn" type="submit">
                Oznacz jako zrealizowaną
              </button>
            </form>
          )}
          {["PENDING", "PROPOSED", "CONFIRMED"].includes(status) && (
            <form action={setBookingStatus} style={{ marginLeft: "auto" }}>
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="status" value="CANCELLED" />
              <button className="btn btn-danger" type="submit">
                Odwołaj wizytę
              </button>
            </form>
          )}
        </div>
      </div>

      {["PENDING", "PROPOSED", "CONFIRMED"].includes(status) && (
        <EditBookingForm
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            durationMin: s.durationMin,
            active: s.active,
          }))}
          booking={{
            id: booking.id,
            serviceId: booking.serviceId,
            date: dateKey(booking.startAt),
            time: fmtTime(booking.startAt),
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            customerEmail: booking.customerEmail ?? "",
            carModel: booking.carModel,
            carPlate: booking.carPlate ?? "",
            notes: booking.notes ?? "",
          }}
        />
      )}

      {["PENDING", "PROPOSED", "CONFIRMED"].includes(status) && (
        <ProposeTimeForm
          bookingId={booking.id}
          defaultDate={from}
          suggestions={suggestions.map((s) => ({
            start: s.start,
            date: s.date,
            label: s.label,
            dateLabel: fmtDateShort(s.date),
          }))}
        />
      )}

      {status === "PENDING" && (
        <div className="card">
          <div className="section-head"><h2>Odrzuć zgłoszenie</h2></div>
          <form action={rejectBooking}>
            <input type="hidden" name="id" value={booking.id} />
            <div className="field">
              <label htmlFor="reject-note">Powód (trafi do klienta)</label>
              <input id="reject-note" name="note" type="text" placeholder="Np. brak części na ten termin." />
            </div>
            <button className="btn btn-danger" type="submit">
              Odrzuć
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="section-head"><h2>Historia tego klienta</h2></div>
        {history.length === 0 ? (
          <div className="empty">To pierwsza wizyta tego numeru telefonu.</div>
        ) : (
          <table>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td style={{ width: 210 }}>{fmtDateTime(h.startAt)}</td>
                  <td>{h.service.name}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className={statusClass(h.status)}>
                      {STATUS_LABEL[h.status as BookingStatusValue]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
