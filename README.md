# System rezerwacji online dla warsztatów

MVP z dokumentu „System rezerwacji online dla warsztatów samochodowych i detailingu”:
klient rezerwuje wizytę sam, warsztat akceptuje, odrzuca albo proponuje inny termin.

Jedna aplikacja Next.js obsługuje oba widoki — publiczną stronę rezerwacji (`/w/<slug>`)
i panel właściciela (`/panel`).

---

Wdrożenie na serwer opisuje **`docs/wdrozenie.md`** — od założenia bazy po test
po starcie.

## Uruchomienie

Wymagany Node 18.18+ (zalecany 20 lub 22).

```bash
npm install          # instaluje zależności i generuje klienta Prismy
cp .env.example .env # (plik .env jest już w paczce — możesz pominąć)
npm run setup        # tworzy bazę SQLite i wgrywa dane demonstracyjne
npm run dev
```

Potem:

| Co | Adres |
| --- | --- |
| Strona rezerwacji | http://localhost:3000/w/demo |
| Panel warsztatu | http://localhost:3000/panel |
| Panel operatora | http://localhost:3000/admin |

Dane logowania do panelu demo: **login `demo`, hasło `demo1234`**.
Do panelu operatora: hasło z `ADMIN_PASSWORD` w `.env` (domyślnie `admin1234` — zmień je).

Powiadomienia mailowe działają od razu w trybie testowym — treść maila pojawia się
w konsoli, w której uruchomiłeś `npm run dev`. Żeby wysyłać prawdziwe maile, dopisz
`RESEND_API_KEY` do `.env`.

### Pozostałe komendy

```bash
npm test         # testy logiki kalendarza, dat, limitów i retencji (bez bazy)
npm run rodo:cleanup  # anonimizacja danych po okresie retencji
npm run przypomnienia # wysyłka przypomnień o zbliżających się wizytach
npm run typecheck
npm run build
npm run db:studio  # graficzny podgląd bazy
npm run db:backup  # kopia bazy SQLite do katalogu backups/
npm run db:postgres  # przełącz schemat na Postgresa (przed wdrożeniem)
npm run db:sqlite    # i z powrotem na pracę lokalną
```

---

## Co jest w środku

**Panel klienta** (`/w/<slug>`)

- wybór usługi z czasem trwania i ceną orientacyjną,
- pasek 14 dni z liczbą wolnych okienek + siatka godzin,
- formularz: imię i nazwisko, telefon, e-mail, model auta, rejestracja, uwagi,
- strona statusu rezerwacji pod unikalnym linkiem — odwołanie wizyty i akceptacja
  zaproponowanego terminu bez dzwonienia i bez zakładania konta,
- **„Dodaj do kalendarza”** — plik `.ics` z wizytą i przypomnieniem, działa w Kalendarzu
  Apple, Google i Outlooku.

**Panel właściciela** (`/panel`)

- lista zgłoszeń czekających na decyzję z licznikiem w menu,
- akceptuj / odrzuć (z powodem) / zaproponuj inny termin — z podpowiedzią
  najbliższych realnie wolnych okienek,
- **edycja istniejącej wizyty**: przesunięcie godziny, zmiana usługi (z przeliczeniem czasu
  zakończenia) i poprawki danych klienta, z opcjonalnym powiadomieniem mailem,
- kalendarz dzienny i tygodniowy,
- baza klientów zbudowana wokół numeru telefonu: historia wizyt, auta,
  najbliższa i ostatnia wizyta, wyszukiwarka po nazwisku / telefonie / rejestracji,
- **wpisywanie wizyt umówionych przez telefon** — bez ograniczenia wyprzedzenia i bez etapu
  akceptacji,
- ustawienia: usługi, godziny pracy, liczba stanowisk, przerwy, dni wolne, przypomnienia
  (mail/SMS, ile godzin przed) i okres przechowywania danych klientów.

**Panel operatora** (`/admin`) — Twoje miejsce, nie właścicieli warsztatów

- lista warsztatów z licznikami: rezerwacje, nadchodzące wizyty, zaległe zgłoszenia,
  data ostatniej rezerwacji,
- kafelki na górze: liczba warsztatów, miesięczny przychód z aktywnych abonamentów,
  łączna liczba rezerwacji,
- zakładanie warsztatu jednym formularzem — godziny pracy i pięć typowych usług
  wchodzą domyślnie, hasło startowe generuje się samo i pokazuje **raz**,
- abonament: status (próbny / aktywny / wstrzymany), data „opłacone do”, kwota
  miesięczna oraz przycisk „przedłuż o 30 dni”,
- **wejście do panelu warsztatu bez pytania o hasło** — do pomocy klientowi; panel wyświetla
  wtedy pomarańczowy pasek „oglądasz jako operator”, żeby nie dało się zapomnieć, czyje dane
  się właśnie przegląda,
- reset hasła właściciela i usunięcie warsztatu z potwierdzeniem przez przepisanie adresu.

---

## Przypomnienia i kalendarz

**Przypomnienia** wychodzą mailem, a opcjonalnie także SMS-em przez Twilio. Warsztat ustawia
w panelu, czy chce je wysyłać, ile godzin przed wizytą i czy dokładać SMS (kosztuje, więc
domyślnie wyłączony). Wychodzą wyłącznie dla wizyt **potwierdzonych** — klient, którego
zgłoszenie nadal czeka na decyzję, dostałby przypomnienie o czymś, co może się nie odbyć.
Pole `reminderSentAt` pilnuje, żeby to samo przypomnienie nie poszło dwa razy, nawet gdy
zadanie odpali się częściej.

Numery normalizujemy do formatu E.164 (`601 234 567` → `+48601234567`) i pomijamy numery
stacjonarne — SMS na nie nie dojdzie, a i tak zostałby naliczony.

**Plik kalendarza** (`/w/<slug>/rezerwacja/<token>/kalendarz.ics`) jest chroniony tym samym
tokenem co strona statusu wizyty, więc działa prosto z maila, bez logowania. Zawiera alarm
ustawiony na tę samą liczbę godzin, co przypomnienia warsztatu, oraz `SEQUENCE` rosnący przy
każdej edycji — dzięki temu po przesunięciu wizyty kalendarz nadpisuje stary wpis, zamiast
dokładać drugi.

Tu siedzi najbardziej podstępna pułapka całego projektu. W bazie trzymamy **czas ścienny**
warsztatu, a plik `.ics` musi zawierać prawdziwy moment UTC. Bez konwersji wizyta o 10:00
wpadałaby klientowi do kalendarza o 12:00 przez pół roku, kiedy obowiązuje czas letni.
Konwersję robi `wallToUtc()` w `src/lib/time.ts`, a testy sprawdzają ją po obu stronach
zmiany czasu.

**Zadania cykliczne.** Oba skrypty są wystawione również jako adresy HTTP — `/api/cron/
przypomnienia` i `/api/cron/rodo` — chronione sekretem z `CRON_SECRET`. Gotowy harmonogram
dla Vercela leży w `vercel.json`: przypomnienia co godzinę, sprzątanie danych raz na dobę.
Bez ustawionego sekretu adresy są zamknięte.

## Ochrona formularza rezerwacji

Zgłoszenie od razu blokuje slot, więc niezabezpieczony formularz to gotowy sposób na zapchanie
warsztatowi tygodnia. Zamiast captchy (konto u zewnętrznego dostawcy, gorsza konwersja, jeszcze
jeden podmiot przetwarzający dane) stoją trzy tanie bariery, opisane w `src/lib/antispam.ts`:

1. **pole-pułapka** — ukryte poza ekranem, poza kolejnością tabulacji i przed czytnikami ekranu;
   człowiek go nie wypełni, bot owszem,
2. **podpisany znacznik czasu** — formularz wysłany szybciej niż w 3 sekundy albo starszy niż
   3 godziny jest odrzucany; podpis HMAC uniemożliwia podrobienie czasu,
3. **limity ilościowe** — trzy otwarte zgłoszenia na numer telefonu w jednym warsztacie, pięć
   zgłoszeń dziennie z jednego adresu IP na warsztat i dwadzieścia globalnie.

Żadna z tych barier nie jest szczelna z osobna; razem podnoszą koszt ataku na tyle, że przy tej
skali przestaje się opłacać. Przy pierwszym realnym nadużyciu następnym krokiem jest
weryfikacja numeru SMS-em.

Adresu IP nie zapisujemy — w bazie ląduje tylko jego skrót HMAC, który wystarcza do
limitowania, a nie pozwala odtworzyć adresu.

## RODO

Pełna lista w `docs/rodo.md`, wzór umowy powierzenia w `docs/umowa-powierzenia.md`.
W skrócie: **administratorem danych jest warsztat**, a Ty jako dostawca systemu jesteś
podmiotem przetwarzającym — stąd klauzula informacyjna wskazuje warsztat, a między Wami
potrzebna jest umowa powierzenia.

Co robi sam system:

- klauzula informacyjna pod adresem `/w/<slug>/prywatnosc`, składana z danych warsztatu,
- checkbox potwierdzający zapoznanie się z nią — bez niego zgłoszenia nie da się wysłać,
  a moment jego zaznaczenia trafia do pola `consentAt`,
- „usuń dane tego klienta” w zakładce Klienci — anonimizacja zamiast kasowania: znika imię,
  telefon, e-mail i auto, zostaje sam fakt wykonania usługi, więc warsztat nie traci historii
  przychodu,
- okres przechowywania ustawiany przez warsztat (domyślnie 24 miesiące) i skrypt
  `npm run rodo:cleanup`, który po tym czasie anonimizuje wizyty automatycznie.

Skrypt trzeba uruchamiać cyklicznie. Lokalnie ręcznie, po wdrożeniu — zadaniem cron pod
`/api/cron/rodo` (harmonogram gotowy w `vercel.json`). Inaczej deklaracja z klauzuli
informacyjnej pozostaje pustą obietnicą.

> Dokumenty w `docs/` są rzetelnym punktem wyjścia, ale nie są poradą prawną. Przed pierwszą
> fakturą warto dać je prawnikowi do przejrzenia.

---

## Decyzje projektowe warte odnotowania

**Sloty są realne, nie życzeniowe.** Dokument miał tu sprzeczność: pokazywał klientowi
kalendarz dostępności i jednocześnie kazał czekać na akceptację. Tutaj kalendarz pokazuje
tylko terminy, w których warsztat faktycznie ma wolne stanowisko, a rezerwacja i tak trafia
do właściciela jako `PENDING`. Zgłoszenie blokuje slot od razu — dzięki temu dwóch klientów
nie zajmie tego samego okienka, zanim właściciel zdąży kliknąć.

**Pojemność liczona po szczycie nakładania.** Usługa ma `durationMin`, warsztat ma `bays`
(liczbę stanowisk). Termin jest wolny, jeśli w żadnym momencie jego trwania liczba
równoległych wizyt nie osiąga `bays`. Nie wystarczy policzyć nachodzących rezerwacji —
mogą się nakładać tylko częściowo. Logika siedzi w `src/lib/availability.ts`
(`fitsCapacity`), a testy w `tests/logic.test.ts` pilnują przypadków brzegowych.

**Czas.** Wszystkie daty to „czas ścienny” warsztatu zapisany w polach UTC — nigdy nie
konwertujemy stref przy odczycie. Godzina 10:00 zapisana w bazie to 10:00 dla warsztatu
i dla klienta, niezależnie od tego, gdzie stoi serwer, i bez niespodzianek przy zmianie
czasu letniego. Cała obsługa w `src/lib/time.ts`.

**Status jako tekst, nie enum.** SQLite nie ma typu wyliczeniowego, a dzięki temu ten sam
schemat przejdzie bez zmian na Postgresa. Dozwolone wartości opisuje `BookingStatusValue`
w `src/lib/status.ts`.

**Dostęp operatora to jedno hasło w `.env`, nie tabela w bazie.** Przy jednym operatorze
tabela `Admin` byłaby kodem bez odbiorcy: zakładanie kont, reset hasła, role. Sesja siedzi
w osobnym ciasteczku niż panel warsztatu, a jej podpis jest wyprowadzony z aktualnego hasła —
zmiana `ADMIN_PASSWORD` natychmiast wylogowuje wszystkie sesje. Gdy dojdzie wspólnik,
wymiana tego na tabelę nie ruszy widoków.

**Wstrzymany abonament wyłącza tylko stronę rezerwacji.** Panel warsztatu i historia wizyt
działają dalej — odcięcie klienta od jego własnych danych za jedną spóźnioną fakturę to
zły pomysł. Sama data „opłacone do” niczego nie wyłącza automatycznie: minięcie terminu
podświetla się w panelu, ale decyzję podejmujesz Ty, nie zegar.

**Hasło startowe widać raz.** Hasła są trzymane jako skrót scrypt, więc nie da się ich
odczytać — zgubione się resetuje. Świeżo wygenerowane pokazuje się po zapisaniu w adresie
strony; jeśli kiedyś panel operatora trafi na wspólny komputer, warto to przenieść do
jednorazowego wpisu w bazie.

**Wizyta z telefonu omija akceptację, ale nie kalendarz.** Warsztat nie musi zatwierdzać
własnego wpisu, więc powstaje od razu jako potwierdzona. Nadal jednak przechodzi przez ten sam
silnik dostępności — inaczej kalendarz kłamałby w drugą stronę. Jest za to świadoma furtka:
zaznaczenie „wpisz godzinę ręcznie” pomija kontrolę zajętości, bo o swoim podnośniku
i nadgodzinach właściciel wie więcej niż nasz kod. Każda wizyta ma pole `source`, więc po
miesiącu widać, ile ruchu naprawdę przeszło przez internet, a ile nadal przez słuchawkę —
to najuczciwsza miara tego, czy system się przyjął.

**Edycja wizyty to osobna ścieżka od propozycji terminu.** „Zaproponuj inny termin” pyta
klienta o zgodę i czeka na jego decyzję. „Edytuj wizytę” jest do sytuacji, w której warsztat
poprawia własny wpis — pomylił godzinę albo klient zadzwonił, że przyjedzie później. Mieszanie
tych dwóch rzeczy zmuszałoby do wysyłania klientowi propozycji przy każdej literówce.

**Widok operatora zostawia ślad na ekranie.** Wejście do panelu warsztatu nie wylogowuje
właściciela i nie wymaga jego hasła — ale dopóki trwa, u góry wisi pasek z nazwą warsztatu.
To dane osobowe cudzych klientów i najgorszym wariantem byłoby przeglądanie ich w przekonaniu,
że jest się u siebie. Następnym krokiem, przy większej skali, jest rejestr wejść: kto, kiedy,
do którego warsztatu.

**Kontrola kolizji dwa razy.** Raz przy rysowaniu kalendarza, drugi raz przy zapisie
(`isSlotBookable`) — między jednym a drugim ktoś mógł zająć ten sam slot.

---

## Struktura

```
prisma/schema.prisma      model danych + komentarze
prisma/seed.ts            warsztat demo, usługi, godziny pracy, przykładowe wizyty
src/lib/time.ts           czas ścienny, formatowanie po polsku
src/lib/availability.ts   generowanie slotów i kontrola pojemności
src/lib/auth.ts           hasła (scrypt) i podpisana sesja w ciasteczku
src/lib/notify.ts         maile: konsola lub Resend; miejsce na SMS
src/lib/admin.ts          dostęp operatora (hasło z ADMIN_PASSWORD)
src/lib/antispam.ts       pułapka, token formularza, limity zgłoszeń
src/lib/privacy.ts        anonimizacja i retencja danych
src/lib/reminders.ts      przypomnienia o wizytach (mail + SMS)
src/lib/ics.ts            plik kalendarza w formacie iCalendar
src/lib/phone.ts          normalizacja numerów do E.164
vercel.json               harmonogram zadań cyklicznych
scripts/rodo-cleanup.ts   sprzątanie po okresie retencji
scripts/backup.ts         kopia zapasowa bazy SQLite
prisma/demo-data.ts       trzy warsztaty demonstracyjne
src/app/ThemeToggle.tsx   przełącznik motywu
docs/wdrozenie.md         krok po kroku: Neon, Vercel, Resend, domena
docs/                     rodo.md i wzór umowy powierzenia
src/lib/subscription.ts   statusy abonamentu i terminy
src/lib/defaults.ts       usługi i godziny startowe, slug, hasło startowe
src/app/admin/            panel operatora
src/app/w/[slug]/         publiczna rezerwacja
src/app/panel/            panel właściciela
src/app/actions/          akcje serwerowe (panel + klient)
src/app/api/              availability + zapis rezerwacji
tests/logic.test.ts       testy kalendarza i dat
```

---

## Czego świadomie jeszcze nie ma

To jest etap 1 z planu wdrożenia. Poza zakresem MVP zostały:

- **Zaliczki online** — przy no-show to zwykle mocniejszy argument sprzedażowy niż sam
  kalendarz, warto rozważyć przesunięcie tego wcześniej niż zakłada dokument.
- **Samodzielna rejestracja warsztatów** — konto zakłada operator w `/admin`; publiczna
  strona rejestracji wymagałaby weryfikacji e-mail i ochrony przed spamem.
- **Subdomeny** — każdy warsztat ma dziś adres `/w/<slug>`, nie `<slug>.twojadomena.pl`.
  Przy wdrożeniu na Vercelu to kwestia wildcard DNS i przepisania slugu z nagłówka Host.
- **Płatności online** — abonament odhaczasz ręcznie; Stripe albo Przelewy24 to osobny etap.
- **Statystyki dla właściciela** — obłożenie kalendarza, najpopularniejsze usługi.

Drobiazg techniczny: wyszukiwarka klientów rozróżnia wielkość liter, bo SQLite nie wspiera
`mode: "insensitive"` w Prismie. Po przejściu na Postgresa wystarczy dopisać ten parametr
w `src/app/panel/klienci/page.tsx`.

---

## Widok na telefonie

Większość klientów rezerwuje z telefonu, więc układ przy 390 px był sprawdzany osobno, a nie
„przy okazji”. Trzy rzeczy wymagały odrębnego traktowania:

- **menu panelu** — pięć pozycji łamało się na trzy linijki i zjadało pół ekranu; na wąskim
  ekranie jest to jeden rząd przewijany poziomo,
- **tabele klucz–wartość** — sztywna kolumna etykiet 165 px zabierała prawie połowę szerokości,
  więc poniżej 620 px etykieta ląduje nad wartością,
- **cele dotykowe** — pod `@media (pointer: coarse)` małe przyciski, sloty i przełączniki
  rosną do rozmiaru, w który da się trafić palcem; na myszy zostaje kompaktowo.

## Motyw jasny i ciemny

W pasku górnym każdego widoku siedzi przełącznik: **system / jasny / ciemny**. Wybór ląduje
w `localStorage` i jest przywracany skryptem w `<head>` jeszcze przed pierwszym malowaniem —
inaczej przy każdym wejściu mignęłoby białe tło.

Każdy kolor zapisany jest raz, funkcją `light-dark()`, a przełączanie sprowadza się do zmiany
`color-scheme` przez atrybut `data-theme` na `<html>`. Dzięki temu nie ma dwóch kopii palety,
które mogłyby się rozjechać. Każdy token ma nad sobą zwykłą wartość jasną jako zapas, więc
przeglądarka bez obsługi `light-dark()` pokaże motyw jasny zamiast rozsypanego układu.

Sprawdzone realnym renderem w czterech kombinacjach: system jasny i ciemny, każdy z ręcznym
nadpisaniem i bez.

## Obsługa błędów

Dwie warstwy. Błędy, na które użytkownik realnie może trafić i coś z nimi zrobić — zajęty
termin, zła godzina przerwy, literówka w potwierdzeniu usunięcia warsztatu — wracają jako
`ActionState` i pokazują się nad formularzem, bez utraty wpisanych danych. Reszta trafia do
`src/app/error.tsx`: ekran po polsku z przyciskiem „spróbuj ponownie” zamiast stosu wywołań.
Do tego własna strona 404 — domyślna jest po angielsku i wygląda jak awaria serwera.

## Warstwa wizualna

Cały wygląd siedzi w jednym pliku `src/app/globals.css` — bez Tailwinda i bez biblioteki
komponentów. Kolory, promienie i cienie są zmiennymi CSS, więc zmiana motywu to podmiana
kilkunastu wartości na górze pliku, a nie przepisywanie widoków. Motyw jasny i ciemny
przełącza się automatycznie za ustawieniem systemu.

Jedna pułapka warta zapamiętania: selektor `input[type="text"]` **nie** łapie pól bez
atrybutu `type`, choć zachowują się one dokładnie jak tekstowe. Dlatego style celują
w `input:not([type="checkbox"]):not([type="radio"])…`. Wcześniejsza wersja miała ten błąd
i połowa pól renderowała się z domyślnym białym tłem przeglądarki.

## Uwaga o testach

Środowisko, w którym powstawał ten kod, nie miało dostępu do serwera binariów Prismy,
więc nie dało się tu uruchomić `prisma generate` ani realnie odpalić aplikacji z bazą.
Zweryfikowane zostało: pełne sprawdzenie typów (`tsc --noEmit`), produkcyjny build
Next.js (wszystkie 22 trasy kompilują się poprawnie), 37 testów logiki kalendarza, dat,
pojemności stanowisk, abonamentów, ochrony formularza, retencji danych, numerów telefonu,
konwersji stref czasowych, struktury pliku .ics, wyszukiwarki i spójności danych
demonstracyjnych, a wygląd — przez
realny render w Chromium (łącznie ze sprawdzeniem, że pole-pułapka faktycznie stoi poza
ekranem, i że przełącznik motywu działa we wszystkich czterech kombinacjach). Osobno przeszedł
audyt mobilny przy szerokości 390 px: skrypt mierzy przepełnienie w poziomie i rozmiary celów
dotykowych — dziś zero pikseli przepełnienia.
Nieprzetestowane pozostały zapytania Prismy w locie — jeśli przy pierwszym uruchomieniu
coś sypnie, to najprawdopodobniej właśnie tam.

Po podmianie plików trzeba raz przepuścić migrację, bo w tabeli warsztatów przybyły
kolumny abonamentu:

```bash
npm run db:push
```
