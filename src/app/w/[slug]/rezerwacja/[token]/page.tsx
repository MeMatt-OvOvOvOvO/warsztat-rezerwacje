import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtDateTime, fmtDuration, fmtTime, nowWall } from "@/lib/time";
import { STATUS_LABEL, statusClass, type BookingStatusValue } from "@/lib/status";
import { acceptProposal, cancelBooking, declineProposal } from "@/app/actions/customer";
import ThemeToggle from "@/app/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  const booking = await db.booking.findUnique({
    where: { manageToken: token },
    include: { workshop: true, service: true },
  });

  if (!booking || booking.workshop.slug !== slug) notFound();

  const status = booking.status as BookingStatusValue;
  const isPast = booking.startAt.getTime() < nowWall().getTime();
  const canCancel = !isPast && ["PENDING", "PROPOSED", "CONFIRMED"].includes(status);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href={`/w/${slug}`}>
            {booking.workshop.name}
          </Link>
          <span className="spacer">
            <ThemeToggle />
          </span>
        </div>
      </header>

      <main className="page">
        <h1>Twoja rezerwacja</h1>

        <div className="card">
          <div className="row-between mb">
            <h2 style={{ margin: 0 }}>{booking.service.name}</h2>
            <span className={statusClass(status)}>{STATUS_LABEL[status]}</span>
          </div>

          {status === "PENDING" && (
            <div className="alert alert-info">
              Zgłoszenie czeka na potwierdzenie przez warsztat. Damy znać, gdy termin zostanie
              zaakceptowany.
            </div>
          )}
          {status === "CONFIRMED" && (
            <div className="alert alert-ok">Termin jest potwierdzony. Do zobaczenia!</div>
          )}
          {status === "PROPOSED" && (
            <div className="alert alert-info">
              Warsztat nie mógł przyjąć pierwotnego terminu i proponuje inny. Potwierdź poniżej, czy
              Ci odpowiada.
            </div>
          )}
          {status === "REJECTED" && (
            <div className="alert alert-error">
              Warsztat nie mógł przyjąć tego zgłoszenia.
              {booking.workshopNote ? ` Powód: ${booking.workshopNote}` : ""}
            </div>
          )}
          {status === "CANCELLED" && (
            <div className="alert alert-error">Ta rezerwacja została odwołana.</div>
          )}

          <table className="kv">
            <tbody>
              <tr>
                <td>Termin</td>
                <td>
                  <strong>{fmtDateTime(booking.startAt)}</strong>
                  <span className="muted"> – {fmtTime(booking.endAt)}</span>
                </td>
              </tr>
              {booking.originalStartAt && (
                <tr>
                  <td>Pierwotny termin</td>
                  <td className="muted" style={{ textDecoration: "line-through" }}>
                    {fmtDateTime(booking.originalStartAt)}
                  </td>
                </tr>
              )}
              <tr>
                <td>Czas trwania</td>
                <td>{fmtDuration(booking.service.durationMin)}</td>
              </tr>
              <tr>
                <td>Auto</td>
                <td>
                  {booking.carModel}
                  {booking.carPlate ? ` (${booking.carPlate})` : ""}
                </td>
              </tr>
              <tr>
                <td>Kontakt</td>
                <td>
                  {booking.customerName}, {booking.customerPhone}
                </td>
              </tr>
              {booking.notes && (
                <tr>
                  <td>Uwagi</td>
                  <td>{booking.notes}</td>
                </tr>
              )}
              {booking.workshopNote && status !== "REJECTED" && (
                <tr>
                  <td>Od warsztatu</td>
                  <td>{booking.workshopNote}</td>
                </tr>
              )}
            </tbody>
          </table>

          <hr className="sep" />

          <div className="row">
            {["PENDING", "PROPOSED", "CONFIRMED"].includes(status) && !isPast && (
              <a className="btn btn-primary" href={`/w/${slug}/rezerwacja/${token}/kalendarz.ics`}>
                Dodaj do kalendarza
              </a>
            )}
            {status === "PROPOSED" && (
              <>
                <form action={acceptProposal}>
                  <input type="hidden" name="token" value={token} />
                  <button className="btn btn-ok" type="submit">
                    Przyjmuję nowy termin
                  </button>
                </form>
                <form action={declineProposal}>
                  <input type="hidden" name="token" value={token} />
                  <button className="btn" type="submit">
                    Nie pasuje mi
                  </button>
                </form>
              </>
            )}
            {canCancel && status !== "PROPOSED" && (
              <form action={cancelBooking}>
                <input type="hidden" name="token" value={token} />
                <button className="btn btn-danger" type="submit">
                  Odwołaj wizytę
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="hint">
          Plik otwiera się w Kalendarzu Apple, Google i Outlooku. Ustawi też przypomnienie na dzień
          przed wizytą.
        </p>

        <p className="muted small center mt">
          Zachowaj ten link — pod nim zawsze sprawdzisz status wizyty.
          {booking.workshop.phone ? ` W pilnej sprawie: ${booking.workshop.phone}.` : ""}
        </p>
        <p className="center">
          <Link className="btn btn-sm" href={`/w/${slug}`}>
            Umów kolejną wizytę
          </Link>
        </p>
      </main>
    </>
  );
}
