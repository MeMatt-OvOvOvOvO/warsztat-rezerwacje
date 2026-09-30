"use client";

import { useActionState, useState } from "react";
import { updateBooking, type ActionState } from "@/app/actions/panel";

type Service = { id: string; name: string; durationMin: number; active: boolean };

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default function EditBookingForm({
  booking,
  services,
}: {
  booking: {
    id: string;
    serviceId: string;
    date: string;
    time: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    carModel: string;
    carPlate: string;
    notes: string;
  };
  services: Service[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateBooking, {});
  const [open, setOpen] = useState(false);

  return (
    <div className="card">
      <div className="row-between">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2>Edytuj wizytę</h2>
          <p>
            Przesuń godzinę, zmień usługę albo popraw dane klienta. Bez pytania go o zgodę — do
            tego służy „zaproponuj inny termin”.
          </p>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Zwiń" : "Edytuj"}
        </button>
      </div>

      {state.saved && !pending && (
        <div className="alert alert-ok mt">Zapisano zmiany.</div>
      )}

      {open && (
        <form action={formAction} className="mt">
          <input type="hidden" name="id" value={booking.id} />

          {state.error && <div className="alert alert-error">{state.error}</div>}

          <div className="grid-2">
            <div className="field">
              <label htmlFor="edit-service">Usługa</label>
              <select id="edit-service" name="serviceId" defaultValue={booking.serviceId} required>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {fmtDuration(s.durationMin)}
                    {s.active ? "" : " (ukryta)"}
                  </option>
                ))}
              </select>
              <div className="hint">Zmiana usługi przelicza godzinę zakończenia wizyty.</div>
            </div>
            <div className="field">
              <label htmlFor="edit-date">Data</label>
              <input id="edit-date" name="date" type="date" defaultValue={booking.date} required />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="edit-time">Godzina</label>
              <input
                id="edit-time"
                name="time"
                type="time"
                step={300}
                defaultValue={booking.time}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit-plate">Nr rejestracyjny</label>
              <input id="edit-plate" name="carPlate" type="text" defaultValue={booking.carPlate} />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="edit-name">Imię i nazwisko *</label>
              <input
                id="edit-name"
                name="customerName"
                type="text"
                defaultValue={booking.customerName}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit-phone">Telefon *</label>
              <input
                id="edit-phone"
                name="customerPhone"
                type="tel"
                defaultValue={booking.customerPhone}
                required
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="edit-car">Marka i model auta *</label>
              <input id="edit-car" name="carModel" type="text" defaultValue={booking.carModel} required />
            </div>
            <div className="field">
              <label htmlFor="edit-email">E-mail</label>
              <input id="edit-email" name="customerEmail" type="email" defaultValue={booking.customerEmail} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="edit-notes">Uwagi</label>
            <textarea id="edit-notes" name="notes" defaultValue={booking.notes} />
          </div>

          <label className="check mb">
            <input type="checkbox" name="override" />
            <span>Pomiń kontrolę zajętości — wciskam wizytę mimo zajętego stanowiska</span>
          </label>

          <label className="check mb">
            <input type="checkbox" name="notify" defaultChecked />
            <span>Powiadom klienta mailem, jeśli zmienił się termin lub usługa</span>
          </label>

          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Zapisuję…" : "Zapisz zmiany"}
          </button>
        </form>
      )}
    </div>
  );
}
