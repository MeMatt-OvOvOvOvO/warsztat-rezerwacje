import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { initials } from "@/lib/text";
import ThemeToggle from "@/app/ThemeToggle";

export const dynamic = "force-dynamic";

/**
 * Klauzula informacyjna RODO składana z danych konkretnego warsztatu.
 *
 * Administratorem danych klienta jest warsztat, a nie dostawca systemu —
 * my jesteśmy podmiotem przetwarzającym i działamy na podstawie umowy
 * powierzenia (wzór w docs/umowa-powierzenia.md).
 *
 * To jest rzetelny punkt wyjścia, a nie opinia prawna. Przed pierwszym
 * wdrożeniem komercyjnym warto dać ten tekst do przejrzenia prawnikowi.
 */
export default async function PrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const workshop = await db.workshop.findUnique({ where: { slug } });
  if (!workshop) notFound();

  const years = Math.round(workshop.retentionMonths / 12);
  const retention =
    workshop.retentionMonths % 12 === 0
      ? `${years} ${years === 1 ? "rok" : years < 5 ? "lata" : "lat"}`
      : `${workshop.retentionMonths} miesięcy`;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href={`/w/${slug}`}>
            <span className="brand-mark">{initials(workshop.name)}</span>
            {workshop.name}
          </Link>
          <span className="spacer">
            <ThemeToggle />
          </span>
        </div>
      </header>

      <main className="page">
        <div className="section-head">
          <h1>Informacja o przetwarzaniu danych osobowych</h1>
          <p>
            Dotyczy danych podawanych przy rezerwacji wizyty online. Dokument przygotowany zgodnie
            z art. 13 RODO.
          </p>
        </div>

        <div className="card">
          <h2>Kto jest administratorem</h2>
          <p>
            Administratorem Twoich danych jest <strong>{workshop.name}</strong>
            {workshop.address ? `, ${workshop.address}` : ""}.
          </p>
          <p className="muted small">
            Kontakt w sprawie danych:{" "}
            {workshop.email ? <a href={`mailto:${workshop.email}`}>{workshop.email}</a> : "—"}
            {workshop.phone ? `, tel. ${workshop.phone}` : ""}.
          </p>
        </div>

        <div className="card">
          <h2>Jakie dane zbieramy i po co</h2>
          <table className="kv">
            <tbody>
              <tr>
                <td>Zakres danych</td>
                <td>
                  imię i nazwisko, numer telefonu, adres e-mail (jeśli podasz), marka i model auta,
                  numer rejestracyjny (jeśli podasz) oraz treść uwag do zgłoszenia
                </td>
              </tr>
              <tr>
                <td>Cel</td>
                <td>
                  umówienie i obsługa wizyty, kontakt w sprawie terminu, prowadzenie historii
                  napraw Twojego auta
                </td>
              </tr>
              <tr>
                <td>Podstawa prawna</td>
                <td>
                  art. 6 ust. 1 lit. b RODO — podjęcie działań na Twoje żądanie przed zawarciem
                  umowy i jej wykonanie; w zakresie historii wizyt i ewentualnych roszczeń art. 6
                  ust. 1 lit. f RODO — prawnie uzasadniony interes warsztatu
                </td>
              </tr>
              <tr>
                <td>Czy musisz je podać</td>
                <td>
                  Podanie danych jest dobrowolne, ale bez imienia, telefonu i informacji o aucie nie
                  da się umówić wizyty. Numer rejestracyjny i e-mail są opcjonalne — e-mail służy do
                  wysłania potwierdzenia i linku do odwołania wizyty.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Jak długo przechowujemy dane</h2>
          <p>
            Dane związane z wizytą przechowujemy przez <strong>{retention}</strong> od jej terminu.
            Po tym czasie są automatycznie anonimizowane — w systemie zostaje sam fakt wykonania
            usługi, bez danych pozwalających Cię zidentyfikować. Dane rozliczeniowe, jeśli powstała
            faktura, warsztat przechowuje przez okres wymagany przepisami podatkowymi.
          </p>
        </div>

        <div className="card">
          <h2>Komu przekazujemy dane</h2>
          <p>
            Dane trafiają wyłącznie do podmiotów, które obsługują ten system w imieniu warsztatu:
            dostawcy systemu rezerwacji, dostawcy hostingu oraz dostawcy usługi wysyłki wiadomości
            e-mail. Każdy z nich działa na podstawie umowy powierzenia przetwarzania danych. Nie
            sprzedajemy danych i nie wykorzystujemy ich do profilowania ani reklamy.
          </p>
        </div>

        <div className="card">
          <h2>Twoje prawa</h2>
          <p>
            Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia
            przetwarzania, przenoszenia oraz wniesienia sprzeciwu wobec przetwarzania opartego na
            prawnie uzasadnionym interesie. Aby z nich skorzystać, napisz albo zadzwoń do warsztatu
            — dane kontaktowe są na górze tej strony.
          </p>
          <p>
            Przysługuje Ci również prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych
            Osobowych (ul. Stawki 2, 00-193 Warszawa), jeśli uznasz, że przetwarzanie narusza
            przepisy.
          </p>
        </div>

        <div className="card">
          <h2>Ciasteczka</h2>
          <p>
            Strona rezerwacji nie używa ciasteczek analitycznych ani reklamowych. Ciasteczko
            techniczne zapisujemy wyłącznie po zalogowaniu do panelu warsztatu — służy do
            utrzymania sesji i bez niego panel nie działa.
          </p>
        </div>

        <p className="center mt">
          <Link className="btn" href={`/w/${slug}`}>
            ← Wróć do rezerwacji
          </Link>
        </p>
      </main>
    </>
  );
}
