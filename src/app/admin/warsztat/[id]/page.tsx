import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminOrRedirect } from "@/lib/admin";
import {
  extendSubscription,
  impersonateWorkshop,
  resetWorkshopPassword,
  setSubscription,
  updateWorkshop,
} from "@/app/actions/admin";
import { appUrl } from "@/lib/notify";
import { dateKey, fmtDate, fmtDateTime, nowWall } from "@/lib/time";
import {
  SUBSCRIPTION_LABEL,
  describeDeadline,
  subscriptionClass,
  type SubscriptionStatusValue,
} from "@/lib/subscription";
import DeleteWorkshopForm from "./DeleteWorkshopForm";

export const dynamic = "force-dynamic";

export default async function AdminWorkshopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ haslo?: string; nowy?: string }>;
}) {
  await requireAdminOrRedirect();
  const { id } = await params;
  const { haslo, nowy } = await searchParams;

  const workshop = await db.workshop.findUnique({
    where: { id },
    include: { services: true },
  });
  if (!workshop) notFound();

  const now = nowWall();

  const [total, pending, upcoming, lastBooking] = await Promise.all([
    db.booking.count({ where: { workshopId: workshop.id } }),
    db.booking.count({ where: { workshopId: workshop.id, status: "PENDING" } }),
    db.booking.count({
      where: {
        workshopId: workshop.id,
        startAt: { gte: now },
        status: { in: ["PENDING", "PROPOSED", "CONFIRMED"] },
      },
    }),
    db.booking.findFirst({
      where: { workshopId: workshop.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const deadline = describeDeadline(workshop.subscriptionUntil);
  const bookingUrl = appUrl(`/w/${workshop.slug}`);

  return (
    <main style={{ maxWidth: 860 }}>
      <p>
        <Link className="btn-link" href="/admin">
          ← Wróć do listy
        </Link>
      </p>

      <div className="row-between mb">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h1>{workshop.name}</h1>
          <p>
            Założony {fmtDate(workshop.createdAt)} ·{" "}
            <span className="mono">{bookingUrl}</span>
          </p>
        </div>
        <span className={subscriptionClass(workshop.subscriptionStatus)}>
          {SUBSCRIPTION_LABEL[workshop.subscriptionStatus as SubscriptionStatusValue] ??
            workshop.subscriptionStatus}
        </span>
      </div>

      {haslo && (
        <div className="card" style={{ borderColor: "var(--accent-border)" }}>
          <div className="section-head">
            <h2>{nowy ? "Warsztat założony" : "Nowe hasło"}</h2>
            <p>
              Przekaż właścicielowi login <strong>{workshop.slug}</strong> i to hasło. Pokazujemy je
              tylko teraz — po odświeżeniu strony zniknie i będzie można je wyłącznie zresetować.
            </p>
          </div>
          <div className="row">
            <span className="secret">{haslo}</span>
            <Link className="btn spacer" href={`/admin/warsztat/${workshop.id}`}>
              Ukryj
            </Link>
          </div>
        </div>
      )}

      <div className="tiles">
        <div className="tile">
          <div className="tile-label">Rezerwacje</div>
          <div className="tile-value">{total}</div>
          <div className="tile-sub">
            {lastBooking ? `ostatnia ${fmtDateTime(lastBooking.createdAt)}` : "jeszcze żadnej"}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Nadchodzące</div>
          <div className="tile-value">{upcoming}</div>
          <div className="tile-sub">{pending} czeka na potwierdzenie</div>
        </div>
        <div className="tile">
          <div className="tile-label">Usługi</div>
          <div className="tile-value">{workshop.services.length}</div>
          <div className="tile-sub">
            {workshop.services.filter((s) => s.active).length} widocznych dla klientów
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Abonament</div>
          <div className="tile-value">{workshop.monthlyPricePln} zł</div>
          <div className="tile-sub">
            {workshop.subscriptionUntil ? `do ${fmtDate(workshop.subscriptionUntil)}, ` : ""}
            {deadline.text}
          </div>
        </div>
      </div>

      {/* ---------- abonament ---------- */}
      <div className="card">
        <div className="section-head">
          <h2>Abonament</h2>
          <p>
            Wstrzymanie wyłącza stronę rezerwacji klientom, ale nie kasuje danych — panel warsztatu
            i historia wizyt zostają nietknięte.
          </p>
        </div>

        <form action={extendSubscription} className="row mb">
          <input type="hidden" name="id" value={workshop.id} />
          <input type="hidden" name="days" value={30} />
          <button className="btn btn-ok" type="submit">
            Opłacone — przedłuż o 30 dni
          </button>
          <span className="muted small">
            Liczę od końca bieżącego okresu, a gdy ten już minął — od dziś.
          </span>
        </form>

        <hr className="sep" />

        <form action={setSubscription}>
          <input type="hidden" name="id" value={workshop.id} />
          <div className="grid-2">
            <div className="field">
              <label htmlFor="subscriptionStatus">Status</label>
              <select
                id="subscriptionStatus"
                name="subscriptionStatus"
                defaultValue={workshop.subscriptionStatus}
              >
                <option value="TRIAL">Okres próbny</option>
                <option value="ACTIVE">Abonament aktywny</option>
                <option value="SUSPENDED">Wstrzymany — strona rezerwacji wyłączona</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="subscriptionUntil">Opłacone do</label>
              <input
                id="subscriptionUntil"
                name="subscriptionUntil"
                type="date"
                defaultValue={
                  workshop.subscriptionUntil ? dateKey(workshop.subscriptionUntil) : undefined
                }
              />
            </div>
          </div>
          <div className="field" style={{ maxWidth: 240 }}>
            <label htmlFor="monthlyPricePln">Kwota miesięczna</label>
            <span className="input-affix">
              <input
                id="monthlyPricePln"
                name="monthlyPricePln"
                type="number"
                min={0}
                max={10000}
                defaultValue={workshop.monthlyPricePln}
              />
              <span>zł</span>
            </span>
          </div>
          <button className="btn btn-primary" type="submit">
            Zapisz abonament
          </button>
        </form>
      </div>

      {/* ---------- dane ---------- */}
      <div className="card">
        <div className="section-head">
          <h2>Dane warsztatu</h2>
          <p>
            Właściciel może to zmieniać sam w swoim panelu. Zmiana adresu unieważnia dotychczasowy
            link rezerwacyjny — stary przestanie działać.
          </p>
        </div>

        <form action={updateWorkshop}>
          <input type="hidden" name="id" value={workshop.id} />
          <div className="grid-2">
            <div className="field">
              <label htmlFor="name">Nazwa</label>
              <input id="name" name="name" type="text" defaultValue={workshop.name} required />
            </div>
            <div className="field">
              <label htmlFor="slug">Adres (identyfikator)</label>
              <input id="slug" name="slug" type="text" defaultValue={workshop.slug} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="email">E-mail do powiadomień</label>
              <input id="email" name="email" type="email" defaultValue={workshop.email ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="phone">Telefon</label>
              <input id="phone" name="phone" type="tel" defaultValue={workshop.phone ?? ""} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="address">Adres</label>
              <input id="address" name="address" type="text" defaultValue={workshop.address ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="bays">Liczba stanowisk</label>
              <input id="bays" name="bays" type="number" min={1} max={20} defaultValue={workshop.bays} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="adminNote">Notatka operatora</label>
            <input id="adminNote" name="adminNote" type="text" defaultValue={workshop.adminNote ?? ""} />
            <div className="hint">Widoczna tylko w tym panelu.</div>
          </div>
          <button className="btn btn-primary" type="submit">
            Zapisz dane
          </button>
        </form>
      </div>

      {/* ---------- dostęp ---------- */}
      <div className="card">
        <div className="section-head">
          <h2>Dostęp do panelu warsztatu</h2>
          <p>
            Login to identyfikator warsztatu: <strong>{workshop.slug}</strong>. Haseł nie da się
            odczytać — są zapisane w postaci skrótu — więc zgubione hasło się resetuje.
          </p>
        </div>
        <div className="row">
          <form action={impersonateWorkshop}>
            <input type="hidden" name="id" value={workshop.id} />
            <button className="btn btn-primary" type="submit">
              Wejdź do panelu warsztatu
            </button>
          </form>
          <form action={resetWorkshopPassword}>
            <input type="hidden" name="id" value={workshop.id} />
            <button className="btn" type="submit">
              Wygeneruj nowe hasło
            </button>
          </form>
          <Link className="btn" href={bookingUrl} target="_blank">
            Otwórz stronę rezerwacji ↗
          </Link>
        </div>
        <p className="hint">
          Wejście do panelu nie wymaga hasła właściciela i nie wylogowuje go — zobaczysz dane
          osobowe jego klientów, więc rób to tylko na jego prośbę.
        </p>
      </div>

      <DeleteWorkshopForm workshopId={workshop.id} slug={workshop.slug} bookingCount={total} />
    </main>
  );
}
