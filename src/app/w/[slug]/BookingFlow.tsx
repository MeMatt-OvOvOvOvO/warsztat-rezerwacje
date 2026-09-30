"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HONEYPOT_FIELD } from "@/lib/form-fields";

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceFrom: number | null;
};

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
  const next = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

function labelDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return `${DAY_SHORT[weekday]} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}

export default function BookingFlow({
  slug,
  services,
  today,
  formToken,
}: {
  slug: string;
  services: Service[];
  today: string;
  /** Podpisany znacznik czasu wystawiony przy renderowaniu strony — patrz src/lib/antispam.ts */
  formToken: string;
}) {
  const router = useRouter();

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [windowStart, setWindowStart] = useState(today);
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    carModel: "",
    carPlate: "",
    notes: "",
  });

  const service = useMemo(() => services.find((s) => s.id === serviceId) || null, [services, serviceId]);
  const selectedDay = useMemo(() => days.find((d) => d.date === selectedDate) || null, [days, selectedDate]);

  const loadAvailability = useCallback(
    async (svc: string, from: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/availability?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(svc)}&from=${from}&days=${WINDOW_DAYS}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Nie udało się pobrać terminów.");
        const list: Day[] = data.days;
        setDays(list);
        setSelectedDate((current) => {
          if (current && list.some((d) => d.date === current && d.slots.length > 0)) return current;
          return list.find((d) => d.slots.length > 0)?.date ?? null;
        });
        setSelectedSlot(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Wystąpił błąd.");
        setDays([]);
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (serviceId) void loadAvailability(serviceId, windowStart);
  }, [serviceId, windowStart, loadAvailability]);

  function pickService(id: string) {
    setServiceId(id);
    setWindowStart(today);
    setSelectedDate(null);
    setSelectedSlot(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          serviceId,
          start: selectedSlot,
          ...form,
          consent,
          formToken,
          [HONEYPOT_FIELD]: trap,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nie udało się wysłać zgłoszenia.");
      router.push(`/w/${slug}/rezerwacja/${data.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd.");
      setSubmitting(false);
      if (serviceId) void loadAvailability(serviceId, windowStart);
    }
  }

  const step = !serviceId ? 1 : !selectedSlot ? 2 : 3;
  const canGoBackInTime = windowStart > today;

  return (
    <div className="mt">
      <div className="steps">
        {["Usługa", "Termin", "Dane"].map((label, i) => {
          const n = i + 1;
          const state = step === n ? " active" : step > n ? " done" : "";
          return (
            <span key={label} style={{ display: "contents" }}>
              {n > 1 && <span className="step-sep">›</span>}
              <span className={`step${state}`}>
                <span className="step-num">{step > n ? "✓" : n}</span> {label}
              </span>
            </span>
          );
        })}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="section-head">
          <h2>1. Wybierz usługę</h2>
        </div>
        <div className="option-list">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              className="option"
              aria-pressed={serviceId === s.id}
              onClick={() => pickService(s.id)}
            >
              <span>
                <strong>{s.name}</strong>
                {s.description && <span className="muted small">{s.description}</span>}
              </span>
              <span className="option-meta">
                <b>{fmtDuration(s.durationMin)}</b>
                {s.priceFrom ? `od ${s.priceFrom} zł` : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      {service && (
        <div className="card">
          <div className="row-between">
            <h2 style={{ margin: 0 }}>2. Wybierz termin</h2>
            <div className="row">
              <button
                type="button"
                className="btn btn-sm"
                disabled={!canGoBackInTime || loading}
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

          <p className="muted small">
            Czas trwania: {fmtDuration(service.durationMin)}. Pokazujemy tylko terminy, w których
            warsztat ma faktycznie wolne stanowisko.
          </p>

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
                    W tym zakresie nie ma wolnych terminów. Sprawdź kolejne dni.
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
        </div>
      )}

      {service && selectedSlot && (
        <form className="card" onSubmit={submit}>
          <div className="section-head">
            <h2>3. Twoje dane</h2>
          </div>
          <div className="alert alert-info">
            {service.name} — {selectedDate && labelDate(selectedDate)},{" "}
            {selectedDay?.slots.find((s) => s.start === selectedSlot)?.label}
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="customerName">Imię i nazwisko *</label>
              <input
                id="customerName"
                type="text"
                required
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="customerPhone">Telefon *</label>
              <input
                id="customerPhone"
                type="tel"
                required
                placeholder="600 100 200"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="customerEmail">E-mail</label>
            <input
              id="customerEmail"
              type="email"
              value={form.customerEmail}
              onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
            />
            <div className="hint">
              Na ten adres wyślemy potwierdzenie i link do odwołania wizyty bez dzwonienia.
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="carModel">Marka i model auta *</label>
              <input
                id="carModel"
                type="text"
                required
                placeholder="Skoda Octavia 1.6 TDI"
                value={form.carModel}
                onChange={(e) => setForm({ ...form, carModel: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="carPlate">Nr rejestracyjny</label>
              <input
                id="carPlate"
                type="text"
                placeholder="WX 12345"
                value={form.carPlate}
                onChange={(e) => setForm({ ...form, carPlate: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="notes">Uwagi dla warsztatu</label>
            <textarea
              id="notes"
              placeholder="Np. stuka przy skręcaniu, auto po wymianie tarcz w zeszłym roku."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {/* pułapka na boty: poza ekranem, poza kolejnością tabulacji, ukryta dla czytników */}
          <div className="honeypot" aria-hidden="true">
            <label htmlFor="firma-pole">Nazwa firmy</label>
            <input
              id="firma-pole"
              name={HONEYPOT_FIELD}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
            />
          </div>

          <label className="check mb">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            <span>
              Podaję dane, żeby umówić wizytę, i zapoznałem się z{" "}
              <Link href={`/w/${slug}/prywatnosc`} target="_blank">
                informacją o przetwarzaniu danych
              </Link>
              . *
            </span>
          </label>

          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={submitting || !consent}
          >
            {submitting ? "Wysyłam…" : "Wyślij zgłoszenie"}
          </button>
          <p className="hint center mt">
            Wysłanie zgłoszenia nie jest jeszcze potwierdzeniem wizyty — warsztat potwierdzi termin.
          </p>
        </form>
      )}
    </div>
  );
}
