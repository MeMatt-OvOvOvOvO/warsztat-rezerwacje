import Link from "next/link";

/**
 * Własna strona 404 — domyślna jest po angielsku i wygląda jak błąd serwera.
 * Trafia tu klient z nieaktualnym linkiem do rezerwacji albo literówką w adresie.
 */
export default function NotFound() {
  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <div className="card">
        <div className="section-head">
          <h1>Nie ma takiej strony</h1>
          <p>
            Link mógł się zdezaktualizować albo zawiera literówkę. Jeśli szukasz swojej wizyty,
            otwórz link z wiadomości, którą dostałeś przy rezerwacji.
          </p>
        </div>
        <Link className="btn btn-primary" href="/">
          Strona główna
        </Link>
      </div>
    </main>
  );
}
