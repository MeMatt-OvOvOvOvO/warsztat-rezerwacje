import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/admin";
import { createWorkshop } from "@/app/actions/admin";
import { appUrl } from "@/lib/notify";

export const dynamic = "force-dynamic";

export default async function NewWorkshopPage() {
  await requireAdminOrRedirect();

  return (
    <main style={{ maxWidth: 780 }}>
      <p>
        <Link className="btn-link" href="/admin">
          ← Wróć do listy
        </Link>
      </p>

      <div className="section-head">
        <h1>Nowy warsztat</h1>
        <p>
          Wystarczy nazwa — resztę właściciel dopracuje u siebie w ustawieniach. Hasło startowe
          pokażemy raz, zaraz po zapisaniu.
        </p>
      </div>

      <form action={createWorkshop}>
        <div className="card">
          <div className="section-head">
            <h2>Dane podstawowe</h2>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="name">Nazwa warsztatu *</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                minLength={3}
                placeholder="Auto-Serwis Kowalski"
              />
            </div>
            <div className="field">
              <label htmlFor="slug">Adres (identyfikator)</label>
              <input id="slug" name="slug" type="text" placeholder="auto-serwis-kowalski" />
              <div className="hint">
                Zostaw puste, a wyliczę go z nazwy. Link będzie wyglądał tak:{" "}
                <span className="mono">{appUrl("/w/adres")}</span>
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="email">E-mail do powiadomień</label>
              <input id="email" name="email" type="email" placeholder="warsztat@example.com" />
              <div className="hint">Tam trafiają nowe zgłoszenia.</div>
            </div>
            <div className="field">
              <label htmlFor="phone">Telefon</label>
              <input id="phone" name="phone" type="tel" placeholder="600 100 200" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="address">Adres warsztatu</label>
            <input id="address" name="address" type="text" placeholder="ul. Warsztatowa 12, Warszawa" />
          </div>
        </div>

        <div className="card">
          <div className="section-head">
            <h2>Kalendarz na start</h2>
            <p>Godziny pracy ustawiam domyślnie: pon–pt 8–17, sobota 9–13, niedziela nieczynna.</p>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="bays">Liczba stanowisk</label>
              <input id="bays" name="bays" type="number" min={1} max={20} defaultValue={1} />
              <div className="hint">Ile aut warsztat obsługuje równolegle.</div>
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
                  defaultValue={30}
                />
                <span>min</span>
              </span>
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
                  defaultValue={2}
                />
                <span>godz.</span>
              </span>
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
                  defaultValue={60}
                />
                <span>dni</span>
              </span>
            </div>
          </div>

          <label className="switch">
            <input type="checkbox" name="withDefaults" defaultChecked />
            <span>dodaj 5 typowych usług na start (klocki, opony, olej, przegląd, diagnostyka)</span>
          </label>
        </div>

        <div className="card">
          <div className="section-head">
            <h2>Abonament i dostęp</h2>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="trialDays">Okres próbny</label>
              <span className="input-affix">
                <input id="trialDays" name="trialDays" type="number" min={0} max={365} defaultValue={30} />
                <span>dni</span>
              </span>
              <div className="hint">0 = od razu abonament aktywny.</div>
            </div>
            <div className="field">
              <label htmlFor="monthlyPricePln">Kwota miesięczna</label>
              <span className="input-affix">
                <input
                  id="monthlyPricePln"
                  name="monthlyPricePln"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={150}
                />
                <span>zł</span>
              </span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Hasło do panelu warsztatu</label>
            <input id="password" name="password" type="text" placeholder="zostaw puste — wygeneruję" />
            <div className="hint">
              Wygenerowane hasło jest łatwe do podyktowania przez telefon i pokaże się raz.
            </div>
          </div>

          <div className="field">
            <label htmlFor="adminNote">Notatka operatora</label>
            <input
              id="adminNote"
              name="adminNote"
              type="text"
              placeholder="Np. polecony przez Tomka, płaci przelewem 10. dnia."
            />
            <div className="hint">Widoczna tylko tutaj — warsztat jej nie zobaczy.</div>
          </div>

          <button className="btn btn-primary btn-block mt" type="submit">
            Załóż warsztat
          </button>
        </div>
      </form>
    </main>
  );
}
