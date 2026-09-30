"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Ekran awarii zamiast surowego błędu Next.js.
 *
 * Łapie wszystko, czego nie obsłużyliśmy w konkretnym formularzu: zerwane
 * połączenie z bazą, nieoczekiwany wyjątek w akcji serwerowej. Właściciel
 * warsztatu ma tu dostać zdanie po polsku i przycisk, a nie stos wywołań.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // w produkcji trafi to do logów hostingu
    console.error("Nieobsłużony błąd:", error);
  }, [error]);

  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <div className="card">
        <div className="section-head">
          <h1>Coś poszło nie tak</h1>
          <p>
            Operacja się nie udała. Twoje dane są bezpieczne — najprawdopodobniej wystarczy
            spróbować jeszcze raz.
          </p>
        </div>

        {error.message && !error.message.startsWith("Error:") && (
          <div className="alert alert-error">{error.message}</div>
        )}

        <div className="row">
          <button className="btn btn-primary" type="button" onClick={reset}>
            Spróbuj ponownie
          </button>
          <Link className="btn" href="/panel">
            Wróć do panelu
          </Link>
        </div>

        {error.digest && (
          <p className="hint mt">
            Jeśli błąd się powtarza, podaj ten numer przy zgłoszeniu:{" "}
            <span className="mono">{error.digest}</span>
          </p>
        )}
      </div>
    </main>
  );
}
