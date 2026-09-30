import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkshopOrRedirect } from "@/lib/auth";
import { dateKey, nowWall } from "@/lib/time";
import ManualBookingForm from "./ManualBookingForm";

export const dynamic = "force-dynamic";

export default async function NewVisitPage() {
  const workshop = await requireWorkshopOrRedirect();

  const services = await db.service.findMany({
    where: { workshopId: workshop.id },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <main style={{ maxWidth: 820 }}>
      <p>
        <Link className="btn-link" href="/panel">
          ← Wróć do zgłoszeń
        </Link>
      </p>

      <div className="section-head">
        <h1>Nowa wizyta</h1>
        <p>
          Do wpisywania wizyt umówionych przez telefon albo przy ladzie. Dzięki temu kalendarz
          pokazuje prawdę — a klient online nie zarezerwuje stanowiska, na którym już stoi auto.
        </p>
      </div>

      {services.length === 0 ? (
        <div className="card">
          <div className="empty">
            Najpierw dodaj choć jedną usługę w{" "}
            <Link href="/panel/ustawienia">ustawieniach</Link> — bez czasu trwania nie da się
            zaplanować wizyty.
          </div>
        </div>
      ) : (
        <ManualBookingForm
          today={dateKey(nowWall())}
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            durationMin: s.durationMin,
            active: s.active,
          }))}
        />
      )}
    </main>
  );
}
