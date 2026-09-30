# Wdrożenie na Vercel

Od aplikacji działającej na laptopie do adresu, który można wysłać warsztatowi.
Wszystko poza jednym poleceniem robi się przez przeglądarkę. Zakładam darmowe plany.

---

## Zanim zaczniesz

Potrzebujesz trzech kont (wszystkie mają darmowy próg wystarczający na pilota):

| Do czego | Gdzie | Koszt na start |
| --- | --- | --- |
| Hosting aplikacji | vercel.com | 0 zł (plan Hobby) |
| Baza PostgreSQL | neon.tech albo supabase.com | 0 zł |
| Wysyłka maili | resend.com | 0 zł do 3000 maili/mies. |

Plus domena, jeśli już ją masz. Bez domeny Vercel i tak da Ci adres
`nazwa-projektu.vercel.app` — na pilota to wystarczy.

---

## 1. Baza danych

1. Załóż projekt w Neon (region **Europe** — dane klientów zostają w UE, mniej tematów z RODO).
2. Skopiuj **dwa** adresy połączenia:
   - z puli połączeń — ma `-pooler` w nazwie hosta → to będzie `DATABASE_URL`,
   - bezpośredni → to będzie `DIRECT_URL`.

Dlaczego dwa: Vercel uruchamia funkcje bezserwerowe, które otwierają mnóstwo krótkich
połączeń — od tego jest pula. Migracje muszą iść połączeniem bezpośrednim, inaczej
`prisma db push` potrafi się zawiesić.

## 2. Przełącz schemat na Postgresa

W projekcie, na laptopie:

```bash
npm run db:postgres
```

Podmienia jedną linijkę w `prisma/schema.prisma` i dokłada `directUrl`.
Powrót do pracy lokalnej na SQLite: `npm run db:sqlite`.

Potem utwórz tabele w nowej bazie — wpisz oba adresy do `.env` i:

```bash
npx prisma db push
npm run db:seed      # opcjonalnie: trzy warsztaty demonstracyjne
```

## 3. Repozytorium

Projekt ma już zainicjowanego gita z pierwszym commitem. Załóż **prywatne** repo na
GitHubie i wypchnij:

```bash
git remote add origin git@github.com:TWOJA-NAZWA/warsztat-rezerwacje.git
git push -u origin main
```

Plik `.env` jest w `.gitignore` — sekrety nie trafią do repozytorium. Sprawdź to przed
pierwszym pushem: `git status --short` nie powinien go wymieniać.

## 4. Vercel

1. **Add New → Project** → wskaż repozytorium. Vercel sam rozpozna Next.js.
2. Zanim klikniesz *Deploy*, rozwiń **Environment Variables** i wklej:

```
DATABASE_URL        adres z puli połączeń (z „-pooler”)
DIRECT_URL          adres bezpośredni
APP_SECRET          długi losowy ciąg — podpisuje sesje i tokeny formularzy
ADMIN_PASSWORD      hasło do panelu operatora (/admin)
CRON_SECRET         długi losowy ciąg — chroni adresy /api/cron/*
NEXT_PUBLIC_APP_URL https://twoja-domena.pl
RESEND_API_KEY      klucz z Resend
MAIL_FROM           Rezerwacje <rezerwacje@twoja-domena.pl>
```

Losowe sekrety wygenerujesz tak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Deploy. Pierwszy build trwa 1–2 minuty.

> `NEXT_PUBLIC_APP_URL` musi być ustawiony **przed** wysyłką pierwszego maila — to z niego
> budują się linki do odwołania wizyty i do pliku kalendarza. Z domyślnym `localhost`
> klient dostanie link, którego nie otworzy.

## 5. Maile

1. W Resend dodaj domenę i wklej rekordy DNS (SPF, DKIM) u swojego rejestratora.
2. Poczekaj na weryfikację — zwykle kilkanaście minut.
3. `MAIL_FROM` musi używać zweryfikowanej domeny. Adres `@gmail.com` nie przejdzie.

Do czasu weryfikacji Resend pozwala wysyłać z `onboarding@resend.dev`, ale tylko na
Twój własny adres — do testu wystarczy, do pilota nie.

## 6. Zadania cykliczne

`vercel.json` jest już w repozytorium i ustawia dwa zadania:

- `/api/cron/przypomnienia` — codziennie o 6:00 UTC (8:00 latem w Polsce),
- `/api/cron/rodo` — codziennie o 3:30 UTC.

**Uwaga o planie Hobby:** darmowy plan Vercela pozwala uruchamiać zadania cykliczne
najwyżej raz na dobę. Dla przypomnień to wystarcza — jeden przebieg rano łapie wszystkie
wizyty z najbliższej doby. Jeśli kiedyś zechcesz przypominać co godzinę (np. przy krótszym
wyprzedzeniu), potrzebny jest plan Pro albo zewnętrzny wyzwalacz, np. darmowy cron-job.org
wołający ten sam adres z nagłówkiem `Authorization: Bearer <CRON_SECRET>`.

Sprawdzenie, czy zadanie działa:

```bash
curl -H "Authorization: Bearer TWOJ_CRON_SECRET" https://twoja-domena.pl/api/cron/przypomnienia
```

Powinno wrócić JSON z licznikami. Bez nagłówka — 401. Jeśli dostajesz 401 z poprawnym
sekretem, najczęstsza przyczyna to spacja doklejona przy kopiowaniu do Vercela.

## 7. Domena

W Vercelu: **Settings → Domains → Add**. Dostaniesz rekordy DNS do wklejenia u rejestratora
(dla domeny `.pl` zwykle u nazwa.pl, OVH albo home.pl). Po propagacji ustaw
`NEXT_PUBLIC_APP_URL` na docelowy adres i zrób redeploy — zmienne środowiskowe wchodzą
dopiero przy nowym buildzie.

---

## Test po wdrożeniu

Przejdź to w tej kolejności, zanim pokażesz komukolwiek:

1. `/w/demo` otwiera się i pokazuje wolne terminy.
2. Rezerwacja przechodzi — dostajesz maila na swój adres (sprawdź też spam).
3. Link z maila otwiera stronę wizyty; „Dodaj do kalendarza" pobiera plik i **godzina się zgadza**.
4. `/panel` — logowanie działa, zgłoszenie widać, akceptacja wysyła maila.
5. `/admin` — logowanie hasłem z `ADMIN_PASSWORD`, zakładanie warsztatu działa.
6. Wywołanie `/api/cron/przypomnienia` z sekretem zwraca JSON.
7. Wejście na `/admin` z pustym `ADMIN_PASSWORD` **nie może** dać dostępu (powinno pokazać
   komunikat o wyłączonym panelu).

## Kopie zapasowe

`npm run db:backup` działa tylko na SQLite. Po przejściu na Postgresa kopie robi dostawca
bazy — w Neon włącz **Point-in-time restore** i raz na jakiś czas sprawdź, czy da się
z kopii faktycznie odtworzyć dane. Kopia, której nikt nigdy nie odtworzył, to nie kopia.

## Czego pilnować po starcie

- **Zużycie Resend** — darmowy próg to 3000 maili miesięcznie; jeden warsztat z 50 wizytami
  to ok. 150 maili, więc długo wystarczy.
- **Limit godzin funkcji na Vercelu** — plan Hobby ma miesięczny limit, przy kilku warsztatach
  nieosiągalny.
- **Neon usypia bazę** po okresie bezczynności na darmowym planie. Pierwsze wejście po przerwie
  potrafi trwać 2–3 sekundy. Przy pilocie to nie problem, przy płacących klientach — płatny plan.
