"use client";

import { useActionState } from "react";
import { addTimeOff, type ActionState } from "@/app/actions/panel";

/**
 * Dodawanie przerwy w kalendarzu.
 *
 * Osobny komponent, bo tu najłatwiej o pomyłkę, którą trzeba pokazać na
 * miejscu: godzina końca wcześniejsza niż początku.
 */
export default function TimeOffForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addTimeOff, {});

  return (
    <form action={formAction}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.saved && !pending && <div className="alert alert-ok">Przerwa dodana.</div>}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="to-date">Data</label>
          <input id="to-date" name="date" type="date" required defaultValue={today} />
        </div>
        <div className="field">
          <label htmlFor="to-reason">Powód</label>
          <input id="to-reason" name="reason" type="text" placeholder="Urlop" />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="to-from">Od</label>
          <input id="to-from" name="from" type="time" defaultValue="00:00" step={300} />
        </div>
        <div className="field">
          <label htmlFor="to-to">Do</label>
          <input id="to-to" name="to" type="time" defaultValue="23:59" step={300} />
        </div>
      </div>
      <div className="row mt">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Dodaję…" : "Dodaj przerwę"}
        </button>
      </div>
    </form>
  );
}
