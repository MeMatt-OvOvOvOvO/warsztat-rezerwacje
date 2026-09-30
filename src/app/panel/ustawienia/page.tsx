import { db } from "@/lib/db";
import { requireWorkshopOrRedirect } from "@/lib/auth";
import {
  deleteService,
  deleteTimeOff,
  saveService,
  saveWorkingHours,
  saveWorkshop,
} from "@/app/actions/panel";
import { appUrl } from "@/lib/notify";
import TimeOffForm from "./TimeOffForm";
import { dateKey, dayName, fmtDate, fmtDuration, fmtMinutes, fmtTime, nowWall } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workshop = await requireWorkshopOrRedirect();

  const [services, hours, timeOff] = await Promise.all([
    db.service.findMany({
      where: { workshopId: workshop.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.workingHours.findMany({ where: { workshopId: workshop.id } }),
    db.timeOff.findMany({
      where: { workshopId: workshop.id, endAt: { gte: nowWall() } },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const hoursByWeekday = new Map(hours.map((h) => [h.weekday, h]));

  return (
    <main>
      <div className="section-head">
        <h1>Ustawienia</h1>
        <p>Dane warsztatu, reguły kalendarza, usługi i dni wolne.</p>
      </div>

      {/* ---------- dane warsztatu ---------- */}
      <div className="card">
        <div className="section-head">
          <h2>Dane warsztatu</h2>
          <p>
            Twój link rezerwacyjny: <span className="mono">{appUrl(`/w/${workshop.slug}`)}</span> —
            wklej go w bio na Instagramie, w wizytówce Google albo pod przyciskiem na stronie.
          </p>
        </div>

        <form action={saveWorkshop}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="name">Nazwa</label>
              <input id="name" name="name" type="text" defaultValue={workshop.name} required />
            </div>
            <div className="field">
              <label htmlFor="phone">Telefon</label>
              <input id="phone" name="phone" type="tel" defaultValue={workshop.phone ?? ""} />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="email">E-mail do powiadomień</label>
              <input id="email" name="email" type="email" defaultValue={workshop.email ?? ""} />
              <div className="hint">Na ten adres przychodzą nowe zgłoszenia.</div>
            </div>
            <div className="field">
              <label htmlFor="address">Adres</label>
              <input id="address" name="address" type="text" defaultValue={workshop.address ?? ""} />
            </div>
          </div>

          <hr className="sep" />

          <div className="section-head">
            <h3>Reguły kalendarza</h3>
            <p>Decydują o tym, które terminy klient w ogóle zobaczy na stronie rezerwacji.</p>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="bays">Liczba stanowisk</label>
              <input id="bays" name="bays" type="number" min={1} max={20} defaultValue={workshop.bays} />
              <div className="hint">Ile aut obsługujecie równolegle w tym samym czasie.</div>
            </div>
            <div className="field">
              <label htmlFor="slotStepMin">Co ile zaczyna się termin</label>
              <span className="input-affix">
                <input
                  id="slotStepMin"
                  name="slotStepMin"
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  defaultValue={workshop.slotStepMin}
                />
                <span>min</span>
              </span>
              <div className="hint">Siatka godzin w kalendarzu klienta.</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="leadTimeHours">Minimalne wyprzedzenie</label>
              <span className="input-affix">
                <input
                  id="leadTimeHours"
                  name="leadTimeHours"
                  type="number"
                  min={0}
                  max={168}
                  defaultValue={workshop.leadTimeHours}
                />
                <span>godz.</span>
              </span>
              <div className="hint">Blokuje rezerwacje „na już”.</div>
            </div>
            <div className="field">
              <label htmlFor="maxAdvanceDays">Maksymalne wyprzedzenie</label>
              <span className="input-affix">
                <input
                  id="maxAdvanceDays"
                  name="maxAdvanceDays"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={workshop.maxAdvanceDays}
                />
                <span>dni</span>
              </span>
              <div className="hint">Jak daleko w przód można się zapisać.</div>
            </div>
          </div>

          <hr className="sep" />

          <div className="section-head">
            <h3>Ochrona danych</h3>
            <p>
              Po tym czasie od wizyty dane klienta są automatycznie anonimizowane: zostaje sam fakt
              wykonania usługi. Ta wartość trafia też do klauzuli informacyjnej na Twojej stronie
              rezerwacji.
            </p>
          </div>

          <div className="field" style={{ maxWidth: 280 }}>
            <label htmlFor="retentionMonths">Przechowywanie danych klienta</label>
            <span className="input-affix">
              <input
                id="retentionMonths"
                name="retentionMonths"
                type="number"
                min={3}
                max={120}
                defaultValue={workshop.retentionMonths}
              />
              <span>mies.</span>
            </span>
            <div className="hint">
              Klauzula:{" "}
              <a href={`/w/${workshop.slug}/prywatnosc`} target="_blank" rel="noreferrer">
                /w/{workshop.slug}/prywatnosc
              </a>
            </div>
          </div>

          <hr className="sep" />

          <div className="section-head">
            <h3>Przypomnienia o wizycie</h3>
            <p>
              Wychodzą tylko dla wizyt potwierdzonych i tylko raz. Mail jest darmowy; SMS kosztuje
              za każdą wiadomość, więc domyślnie jest wyłączony.
            </p>
          </div>

          <label className="check mb">
            <input
              type="checkbox"
              name="remindersEnabled"
              defaultChecked={workshop.remindersEnabled}
            />
            <span>wysyłaj przypomnienia mailem</span>
          </label>

          <label className="check mb">
            <input type="checkbox" name="smsEnabled" defaultChecked={workshop.smsEnabled} />
            <span>wysyłaj też SMS-em (wymaga skonfigurowanej bramki)</span>
          </label>

          <div className="field" style={{ maxWidth: 280 }}>
            <label htmlFor="reminderHoursBefore">Ile przed wizytą</label>
            <span className="input-affix">
              <input
                id="reminderHoursBefore"
                name="reminderHoursBefore"
                type="number"
                min={1}
                max={168}
                defaultValue={workshop.reminderHoursBefore}
              />
              <span>godz.</span>
            </span>
            <div className="hint">
              Ta sama wartość ustawia przypomnienie w pliku kalendarza, który klient dodaje do
              telefonu.
            </div>
          </div>

          <div className="row mt">
            <button className="btn btn-primary" type="submit">
              Zapisz dane
            </button>
          </div>
        </form>
      </div>

      {/* ---------- godziny pracy ---------- */}
      <div className="card">
        <div className="section-head">
          <h2>Godziny pracy</h2>
          <p>Poza tymi godzinami klient nie zobaczy żadnego wolnego terminu.</p>
        </div>

        <form action={saveWorkingHours}>
          <div className="hours-head">
            <span>Dzień</span>
            <span>Od</span>
            <span />
            <span>Do</span>
            <span>Status</span>
          </div>

          {Array.from({ length: 7 }, (_, weekday) => {
            const h = hoursByWeekday.get(weekday);
            const closed = h?.isClosed ?? weekday === 6;
            return (
              <div className={`hours-row${closed ? " is-closed" : ""}`} key={weekday}>
                <span className="hours-day" style={{ textTransform: "capitalize" }}>
                  {dayName(weekday)}
                </span>
                <input
                  type="time"
                  name={`open-${weekday}`}
                  defaultValue={fmtMinutes(h?.openMin ?? 480)}
                  step={300}
                  aria-label={`Otwarcie: ${dayName(weekday)}`}
                />
                <span className="hours-dash">–</span>
                <input
                  type="time"
                  name={`close-${weekday}`}
                  defaultValue={fmtMinutes(h?.closeMin ?? 1020)}
                  step={300}
                  aria-label={`Zamknięcie: ${dayName(weekday)}`}
                />
                <label className="switch">
                  <input type="checkbox" name={`closed-${weekday}`} defaultChecked={closed} />
                  <span>nieczynne</span>
                </label>
              </div>
            );
          })}

          <div className="row mt">
            <button className="btn btn-primary" type="submit">
              Zapisz godziny
            </button>
          </div>
        </form>
      </div>

      {/* ---------- usługi ---------- */}
      <div className="card">
        <div className="section-head">
          <h2>Usługi ({services.length})</h2>
          <p>
            Czas trwania to najważniejsze pole — na jego podstawie liczone jest obłożenie stanowisk.
          </p>
        </div>

        <div className="stack">
          {services.map((s) => (
            <form action={saveService} key={s.id} className="svc">
              <input type="hidden" name="id" value={s.id} />

              <div className="row-between mb">
                <h3 style={{ margin: 0 }}>{s.name}</h3>
                <span className="muted small">
                  {fmtDuration(s.durationMin)}
                  {s.priceFrom ? ` · od ${s.priceFrom} zł` : ""}
                </span>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Nazwa</label>
                  <input name="name" type="text" defaultValue={s.name} required />
                </div>
                <div className="field">
                  <label>Opis</label>
                  <input name="description" type="text" defaultValue={s.description ?? ""} />
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Czas trwania</label>
                  <span className="input-affix">
                    <input
                      name="durationMin"
                      type="number"
                      min={15}
                      max={1440}
                      step={15}
                      defaultValue={s.durationMin}
                    />
                    <span>min</span>
                  </span>
                </div>
                <div className="field">
                  <label>Cena od</label>
                  <span className="input-affix">
                    <input name="priceFrom" type="number" min={0} defaultValue={s.priceFrom ?? ""} />
                    <span>zł</span>
                  </span>
                </div>
              </div>

              <div className="svc-foot">
                <label className="switch">
                  <input type="checkbox" name="active" defaultChecked={s.active} />
                  <span>widoczna dla klientów</span>
                </label>
                <button className="btn btn-sm btn-primary" type="submit">
                  Zapisz
                </button>
                <button
                  className="btn btn-sm btn-danger spacer"
                  type="submit"
                  formAction={deleteService}
                >
                  Usuń
                </button>
              </div>
            </form>
          ))}
        </div>

        <details className="mt">
          <summary>Dodaj usługę</summary>
          <div className="svc mt">
            <form action={saveService}>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="new-name">Nazwa</label>
                  <input
                    id="new-name"
                    name="name"
                    type="text"
                    required
                    placeholder="Wymiana klocków hamulcowych"
                  />
                </div>
                <div className="field">
                  <label htmlFor="new-desc">Opis</label>
                  <input
                    id="new-desc"
                    name="description"
                    type="text"
                    placeholder="Przód lub tył, jedna oś"
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="new-duration">Czas trwania</label>
                  <span className="input-affix">
                    <input
                      id="new-duration"
                      name="durationMin"
                      type="number"
                      min={15}
                      step={15}
                      defaultValue={60}
                    />
                    <span>min</span>
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="new-price">Cena od</label>
                  <span className="input-affix">
                    <input id="new-price" name="priceFrom" type="number" min={0} />
                    <span>zł</span>
                  </span>
                </div>
              </div>
              <div className="svc-foot">
                <label className="switch">
                  <input type="checkbox" name="active" defaultChecked />
                  <span>widoczna dla klientów</span>
                </label>
                <button className="btn btn-sm btn-primary" type="submit">
                  Dodaj usługę
                </button>
              </div>
            </form>
          </div>
        </details>
      </div>

      {/* ---------- przerwy ---------- */}
      <div className="card">
        <div className="section-head">
          <h2>Przerwy i dni wolne</h2>
          <p>Blokuje kalendarz w wybranym czasie — urlop, inwentaryzacja, wyjazd po części.</p>
        </div>

        {timeOff.length > 0 && (
          <table className="mb">
            <tbody>
              {timeOff.map((t) => (
                <tr key={t.id}>
                  <td style={{ width: 220 }}>
                    <strong>{fmtDate(t.startAt)}</strong>
                    <div className="muted small">
                      {fmtTime(t.startAt)}–{fmtTime(t.endAt)}
                    </div>
                  </td>
                  <td className="muted">{t.reason}</td>
                  <td style={{ textAlign: "right" }}>
                    <form action={deleteTimeOff}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="btn btn-sm btn-danger" type="submit">
                        Usuń
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <TimeOffForm today={dateKey(nowWall())} />
      </div>
    </main>
  );
}
