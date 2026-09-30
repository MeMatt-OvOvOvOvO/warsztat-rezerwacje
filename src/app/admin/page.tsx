import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminOrRedirect } from "@/lib/admin";
import { fmtDate, fmtDateTime, nowWall } from "@/lib/time";
import {
  SUBSCRIPTION_LABEL,
  describeDeadline,
  subscriptionClass,
  type SubscriptionStatusValue,
} from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdminOrRedirect();

  const now = nowWall();

  const [workshops, bookings] = await Promise.all([
    db.workshop.findMany({ orderBy: { createdAt: "desc" } }),
    db.booking.findMany({
      select: { workshopId: true, status: true, startAt: true, createdAt: true },
    }),
  ]);

  // agregujemy w pamięci — przy skali „kilkadziesiąt warsztatów” to prostsze niż groupBy
  const stats = new Map<
    string,
    { total: number; pending: number; upcoming: number; lastBooking: Date | null }
  >();

  for (const b of bookings) {
    let entry = stats.get(b.workshopId);
    if (!entry) {
      entry = { total: 0, pending: 0, upcoming: 0, lastBooking: null };
      stats.set(b.workshopId, entry);
    }
    entry.total += 1;
    if (b.status === "PENDING") entry.pending += 1;
    if (b.startAt >= now && ["PENDING", "PROPOSED", "CONFIRMED"].includes(b.status)) {
      entry.upcoming += 1;
    }
    if (!entry.lastBooking || b.createdAt > entry.lastBooking) entry.lastBooking = b.createdAt;
  }

  const active = workshops.filter((w) => w.subscriptionStatus === "ACTIVE");
  const trial = workshops.filter((w) => w.subscriptionStatus === "TRIAL");
  const suspended = workshops.filter((w) => w.subscriptionStatus === "SUSPENDED");
  const mrr = active.reduce((sum, w) => sum + w.monthlyPricePln, 0);
  const pendingTotal = [...stats.values()].reduce((sum, s) => sum + s.pending, 0);

  return (
    <main>
      <div className="row-between mb">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h1>Warsztaty</h1>
          <p>Każdy warsztat ma własny adres rezerwacji, panel i abonament prowadzony ręcznie.</p>
        </div>
        <Link className="btn btn-primary" href="/admin/nowy">
          + Dodaj warsztat
        </Link>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="tile-label">Warsztaty</div>
          <div className="tile-value">{workshops.length}</div>
          <div className="tile-sub">
            {active.length} płacących · {trial.length} na próbie
            {suspended.length > 0 ? ` · ${suspended.length} wstrzymanych` : ""}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Przychód miesięczny</div>
          <div className="tile-value">{mrr} zł</div>
          <div className="tile-sub">tylko abonamenty aktywne</div>
        </div>
        <div className="tile">
          <div className="tile-label">Rezerwacje łącznie</div>
          <div className="tile-value">{bookings.length}</div>
          <div className="tile-sub">od początku działania</div>
        </div>
        <div className="tile">
          <div className="tile-label">Czeka na warsztaty</div>
          <div className="tile-value">{pendingTotal}</div>
          <div className="tile-sub">niepotwierdzonych zgłoszeń</div>
        </div>
      </div>

      {workshops.length === 0 ? (
        <div className="card">
          <div className="empty">
            Nie ma jeszcze żadnego warsztatu. Zacznij od „Dodaj warsztat”.
          </div>
        </div>
      ) : (
        <div className="stack">
          {workshops.map((w) => {
            const s = stats.get(w.id) ?? { total: 0, pending: 0, upcoming: 0, lastBooking: null };
            const deadline = describeDeadline(w.subscriptionUntil);
            return (
              <div className="card" key={w.id}>
                <div className="row-between">
                  <div>
                    <h3 style={{ margin: 0 }}>{w.name}</h3>
                    <div className="muted small">
                      <span className="mono">/w/{w.slug}</span>
                      {w.phone ? ` · ${w.phone}` : ""}
                      {w.email ? ` · ${w.email}` : ""}
                    </div>
                    {w.adminNote && <div className="muted small mt">📝 {w.adminNote}</div>}
                  </div>

                  <div className="stat">
                    <div>
                      <span className={subscriptionClass(w.subscriptionStatus)}>
                        {SUBSCRIPTION_LABEL[w.subscriptionStatus as SubscriptionStatusValue] ??
                          w.subscriptionStatus}
                      </span>
                    </div>
                    <div className={deadline.overdue ? undefined : "muted"}>
                      {w.subscriptionUntil ? `do ${fmtDate(w.subscriptionUntil)} — ` : ""}
                      {deadline.text}
                    </div>
                    <div>
                      <b>{w.monthlyPricePln} zł</b> / mies.
                    </div>
                  </div>
                </div>

                <hr className="sep" />

                <div className="row-between">
                  <div className="row small muted">
                    <span>
                      rezerwacje: <b style={{ color: "var(--text)" }}>{s.total}</b>
                    </span>
                    <span>·</span>
                    <span>nadchodzące: {s.upcoming}</span>
                    <span>·</span>
                    <span>
                      {s.pending > 0 ? (
                        <span className="badge badge-pending">{s.pending} czeka</span>
                      ) : (
                        "brak zaległych zgłoszeń"
                      )}
                    </span>
                    <span>·</span>
                    <span>
                      ostatnia:{" "}
                      {s.lastBooking ? fmtDateTime(s.lastBooking) : "jeszcze żadnej rezerwacji"}
                    </span>
                  </div>

                  <div className="toolbar">
                    <Link className="btn btn-sm" href={`/w/${w.slug}`} target="_blank">
                      Strona ↗
                    </Link>
                    <Link className="btn btn-sm btn-primary" href={`/admin/warsztat/${w.id}`}>
                      Zarządzaj
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
