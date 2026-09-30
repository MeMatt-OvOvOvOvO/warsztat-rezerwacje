"use client";

import { useActionState } from "react";
import { deleteWorkshop, type AdminActionState } from "@/app/actions/admin";

/**
 * Usunięcie warsztatu z potwierdzeniem przez przepisanie adresu.
 *
 * Komponent kliencki, bo literówka w potwierdzeniu to najbardziej spodziewany
 * błąd w całym panelu — musi wrócić jako komunikat przy polu, a nie jako
 * ekran awarii, z którego nie wiadomo, czy coś się usunęło.
 */
export default function DeleteWorkshopForm({
  workshopId,
  slug,
  bookingCount,
}: {
  workshopId: string;
  slug: string;
  bookingCount: number;
}) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    deleteWorkshop,
    {},
  );

  return (
    <div className="card">
      <div className="section-head">
        <h2>Usuń warsztat</h2>
        <p>
          Kasuje warsztat wraz z {bookingCount === 0 ? "wszystkimi" : bookingCount} rezerwacjami,
          usługami i historią klientów. Nie da się tego cofnąć — jeśli chodzi tylko o brak
          płatności, ustaw status „wstrzymany”.
        </p>
      </div>

      <details>
        <summary>Chcę usunąć ten warsztat</summary>
        <form action={formAction} className="mt">
          <input type="hidden" name="id" value={workshopId} />

          {state.error && <div className="alert alert-error">{state.error}</div>}

          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="confirm">
              Przepisz <strong>{slug}</strong>, żeby potwierdzić
            </label>
            <input id="confirm" name="confirm" type="text" autoComplete="off" required />
          </div>
          <button className="btn btn-danger" type="submit" disabled={pending}>
            {pending ? "Usuwam…" : "Usuń warsztat na stałe"}
          </button>
        </form>
      </details>
    </div>
  );
}
