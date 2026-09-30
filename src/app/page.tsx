import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workshops = await db.workshop.findMany({
    orderBy: { name: "asc" },
    select: { slug: true, name: true, address: true },
  });

  return (
    <main className="page">
      <div className="section-head">
        <h1>System rezerwacji warsztatowych</h1>
        <p>
          Każdy warsztat ma własny link rezerwacyjny. Ta strona istnieje tylko po to, żeby wygodnie
          wejść w tryb deweloperski — w produkcji klient trafia od razu pod adres swojego warsztatu.
        </p>
      </div>

      <div className="card">
        <div className="section-head">
          <h2>Warsztaty w bazie</h2>
        </div>
        {workshops.length === 0 ? (
          <div className="empty">
            Baza jest pusta. Uruchom <code className="mono">npm run setup</code>, żeby wgrać dane
            demonstracyjne.
          </div>
        ) : (
          <div className="option-list">
            {workshops.map((w) => (
              <Link key={w.slug} href={`/w/${w.slug}`} className="option">
                <span>
                  <strong>{w.name}</strong>
                  <span className="muted small">{w.address || `/w/${w.slug}`}</span>
                </span>
                <span className="option-meta">Rezerwuj →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-head">
          <h2>Panel warsztatu</h2>
          <p>Miejsce, w którym właściciel przyjmuje zgłoszenia, prowadzi kalendarz i ustawia usługi.</p>
        </div>
        <div className="row">
          <Link className="btn btn-primary" href="/panel">
            Panel warsztatu
          </Link>
          <Link className="btn" href="/admin">
            Panel operatora
          </Link>
        </div>
      </div>
    </main>
  );
}
