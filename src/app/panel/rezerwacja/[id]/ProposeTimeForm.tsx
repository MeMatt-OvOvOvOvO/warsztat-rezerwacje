"use client";

import { useActionState } from "react";
import { proposeTime, type ActionState } from "@/app/actions/panel";

type Suggestion = { start: string; date: string; label: string; dateLabel: string };

/**
 * Propozycja innego terminu.
 *
 * Wydzielone z widoku serwerowego po to, żeby kolizja terminu („ktoś właśnie
 * zajął ten slot”) pokazała się jako komunikat nad formularzem, a nie jako
 * ekran awarii. To najczęstszy błąd w tym miejscu: podpowiedzi są liczone przy
 * renderowaniu strony i potrafią się zdezaktualizować, zanim ktoś kliknie.
 */
export default function ProposeTimeForm({
  bookingId,
  suggestions,
  defaultDate,
}: {
  bookingId: string;
  suggestions: Suggestion[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(proposeTime, {});

  return (
    <div className="card">
      <div className="section-head">
        <h2>Zaproponuj inny termin</h2>
        <p>
          Klient dostanie maila z propozycją i sam ją potwierdzi lub odrzuci. Poniżej najbliższe
          wolne okienka dla tej usługi.
        </p>
      </div>

      {state.error && <div className="alert alert-error">{state.error}</div>}

      {suggestions.length === 0 ? (
        <div className="empty">Brak wolnych okienek w najbliższych 14 dniach.</div>
      ) : (
        <div className="slot-grid mb">
          {suggestions.map((s) => (
            <form action={formAction} key={s.start}>
              <input type="hidden" name="id" value={bookingId} />
              <input type="hidden" name="date" value={s.date} />
              <input type="hidden" name="time" value={s.label} />
              <button className="slot" type="submit" style={{ width: "100%" }} disabled={pending}>
                {s.label}
                <small>{s.dateLabel}</small>
              </button>
            </form>
          ))}
        </div>
      )}

      <details>
        <summary>Wpisz termin ręcznie / dodaj komentarz</summary>
        <form action={formAction} className="mt">
          <input type="hidden" name="id" value={bookingId} />
          <div className="grid-2">
            <div className="field">
              <label htmlFor="propose-date">Data</label>
              <input id="propose-date" name="date" type="date" required defaultValue={defaultDate} />
            </div>
            <div className="field">
              <label htmlFor="propose-time">Godzina</label>
              <input
                id="propose-time"
                name="time"
                type="time"
                required
                defaultValue="09:00"
                step={300}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="propose-note">Komentarz dla klienta</label>
            <input
              id="propose-note"
              name="note"
              type="text"
              placeholder="Np. mamy wtedy wolny podnośnik."
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Wysyłam…" : "Wyślij propozycję"}
          </button>
        </form>
      </details>
    </div>
  );
}
