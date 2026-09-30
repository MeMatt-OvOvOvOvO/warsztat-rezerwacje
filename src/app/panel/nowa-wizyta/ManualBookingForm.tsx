"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { createManualBooking, type ActionState } from "@/app/actions/panel";

type Service = { id: string; name: string; durationMin: number; active: boolean };
type Slot = { start: string; label: string };
type Day = { date: string; weekday: number; closed: boolean; slots: Slot[] };

const DAY_SHORT = ["pon", "wt", "śr", "czw", "pt", "sob", "niedz"];
const WINDOW_DAYS = 14;

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function shiftDate(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

function labelDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return `${DAY_SHORT[weekday]} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}

export default function ManualBookingForm({
  services,
  today,
}: {
  services: Service[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createManualBooking,
    {},
  );

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [windowStart, setWindowStart] = useState(today);
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const service = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [services, serviceId]);
  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) ?? null,
    [days, selectedDate],
  );

  const load = useCallback(async (svc: string, from: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/panel/availability?service=${encodeURIComponent(svc)}&from=${from}&days=${WINDOW_DAYS}`,
      );
      const data = await res.json();
      const list: Day[] = res.ok ? data.days : [];
      setDays(list);
      setSelectedDate((current) => {
        if (current && list.some((d) => d.date === current && d.slots.length > 0)) return current;
        return list.find((d) => d.slots.length > 0)?.date ?? null;
      });
      setSelectedSlot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (serviceId && !manual) void load(serviceId, windowStart);
  }, [serviceId, windowStart, manual, load]);

  return (
    <form action={formAction}>
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="card">
        <div className="section-head">
          <h2>1. Usługa i termin</h2>
          <p>Kalendarz pokazuje wolne okienka bez ograniczenia wyprzedzenia — możesz wpisać wizytę na dziś.</p>
        </div>

        <div className="field">
          <label htmlFor="serviceId">Usługa</label>
          <select
            id="serviceId"
            name="serviceId"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            required
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {fmtDuration(s.durationMin)}
                {s.active ? "" : " (ukryta dla klientów)"}
              </option>
            ))}
          </select>
        </div>

        <label className="check mb">
          <input
            type="checkbox"
            name="override"
            checked={manual}
            onChange={(e) => {
              setManual(e.target.checked);
              setSelectedSlot(null);
            }}
          />
          <span>
            Wpisz godzinę ręcznie i pomiń kontrolę zajętości — przyda się na nadgodziny albo
            wciśnięcie auta między inne wizyty.
          </span>
        </label>

        {manual ? (
          <div className="grid-2">
            <div className="field">
              <label htmlFor="date">Data</label>
              <input id="date" name="date" type="date" defaultValue={today} required />
            </div>
            <div className="field">
              <label htmlFor="time">Godzina</label>
              <input id="time" name="time" type="time" defaultValue="09:00" step={300} required />
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="start" value={selectedSlot ?? ""} />

            <div className="row-between mb">
              <span className="muted small">
                {service ? `Czas trwania: ${fmtDuration(service.durationMin)}` : ""}
              </span>
              <div className="toolbar">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={loading || windowStart <= today}
                  onClick={() =>
                    setWindowStart((w) => {
                      const prev = shiftDate(w, -WINDOW_DAYS);
                      return prev < today ? today : prev;
                    })
                  }
                >
                  ← wcześniej
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={loading}
                  onClick={() => setWindowStart((w) => shiftDate(w, WINDOW_DAYS))}
                >
                  później →
                </button>
              </div>
            </div>

            {loading ? (
              <div className="empty">Szukam wolnych terminów…</div>
            ) : (
              <>
                <div className="day-strip">
                  {days.map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      className="day-chip"
                      aria-pressed={selectedDate === d.date}
                      disabled={d.slots.length === 0}
                      onClick={() => {
                        setSelectedDate(d.date);
                        setSelectedSlot(null);
                      }}
                    >
                      <span className="dc-day">{labelDate(d.date)}</span>
                      <span className="dc-free">
                        {d.closed ? "nieczynne" : d.slots.length === 0 ? "brak" : `${d.slots.length} wolnych`}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt">
                  {!selectedDay ? (
                    <div className="empty">
                      Brak wolnych okienek w tym zakresie. Przejdź dalej albo wpisz godzinę ręcznie.
                    </div>
                  ) : (
                    <div className="slot-grid">
                      {selectedDay.slots.map((s) => (
                        <button
                          key={s.start}
                          type="button"
                          className="slot"
                          aria-pressed={selectedSlot === s.start}
                          onClick={() => setSelectedSlot(s.start)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="section-head">
          <h2>2. Dane klienta</h2>
          <p>
            Wystarczy imię, telefon i auto — resztę można uzupełnić później. Wizyta zapisze się od
            razu jako potwierdzona.
          </p>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="customerName">Imię i nazwisko *</label>
            <input id="customerName" name="customerName" type="text" required />
          </div>
          <div className="field">
            <label htmlFor="customerPhone">Telefon *</label>
            <input id="customerPhone" name="customerPhone" type="tel" required placeholder="600 100 200" />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="carModel">Marka i model auta *</label>
            <input id="carModel" name="carModel" type="text" required placeholder="Skoda Octavia 1.6 TDI" />
          </div>
          <div className="field">
            <label htmlFor="carPlate">Nr rejestracyjny</label>
            <input id="carPlate" name="carPlate" type="text" placeholder="WX 12345" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="customerEmail">E-mail</label>
          <input id="customerEmail" name="customerEmail" type="email" />
          <div className="hint">Potrzebny tylko, jeśli chcesz wysłać potwierdzenie.</div>
        </div>

        <div className="field">
          <label htmlFor="notes">Uwagi</label>
          <textarea id="notes" name="notes" placeholder="Np. klient przywiezie własne klocki." />
        </div>

        <label className="check mb">
          <input type="checkbox" name="notify" defaultChecked />
          <span>Wyślij klientowi potwierdzenie mailem (jeśli podano adres)</span>
        </label>

        <div className="alert alert-info">
          Klient nie wypełnia tu zgody na przetwarzanie danych — obowiązek informacyjny spełniasz
          Ty przy przyjmowaniu zgłoszenia. Wystarczy powiedzieć, po co bierzesz numer telefonu.
        </div>

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={pending || (!manual && !selectedSlot)}
        >
          {pending ? "Zapisuję…" : "Zapisz wizytę"}
        </button>
      </div>
    </form>
  );
}
