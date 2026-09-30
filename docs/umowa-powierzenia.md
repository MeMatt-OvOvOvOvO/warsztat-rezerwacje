# Umowa powierzenia przetwarzania danych osobowych — wzór

> **To jest wzór roboczy, a nie porada prawna.** Zanim podpiszesz go z pierwszym płacącym
> warsztatem, daj go przejrzeć prawnikowi — koszt jednej konsultacji jest nieporównywalnie
> niższy niż kara za źle ułożone powierzenie. Pola w nawiasach kwadratowych uzupełnij.

Zawarta dnia **[data]** pomiędzy:

**[Nazwa warsztatu]**, [adres], NIP [numer], zwanym dalej **Administratorem**,

a

**[Twoja firma / imię i nazwisko]**, [adres], NIP [numer], zwanym dalej **Podmiotem
przetwarzającym**.

---

## §1. Przedmiot i cel powierzenia

1. Administrator powierza Podmiotowi przetwarzającemu przetwarzanie danych osobowych klientów
   Administratora w zakresie i celu określonym niniejszą umową.
2. Celem przetwarzania jest świadczenie na rzecz Administratora usługi systemu rezerwacji wizyt
   online, obejmującej przyjmowanie zgłoszeń, prowadzenie kalendarza wizyt oraz wysyłkę
   powiadomień do klientów Administratora.
3. Powierzenie następuje wyłącznie w zakresie niezbędnym do świadczenia tej usługi.

## §2. Zakres danych i kategorie osób

1. Kategorie osób: klienci Administratora umawiający wizytę.
2. Zakres danych: imię i nazwisko, numer telefonu, adres e-mail, marka i model pojazdu, numer
   rejestracyjny pojazdu, treść uwag przekazanych przy rezerwacji, data i godzina wizyty.
3. Podmiot przetwarzający nie przetwarza szczególnych kategorii danych, o których mowa w art. 9
   RODO.

## §3. Czas trwania

Umowa obowiązuje przez czas korzystania przez Administratora z usługi. Wygasa z dniem
zakończenia świadczenia usługi, z zachowaniem obowiązków z §8.

## §4. Obowiązki Podmiotu przetwarzającego

Podmiot przetwarzający zobowiązuje się do:

1. przetwarzania danych wyłącznie na udokumentowane polecenie Administratora, którym jest
   również sama niniejsza umowa;
2. zapewnienia, by osoby upoważnione do przetwarzania danych zobowiązały się do zachowania
   poufności;
3. stosowania środków technicznych i organizacyjnych zapewniających bezpieczeństwo danych
   odpowiednie do ryzyka, w szczególności: szyfrowania połączeń (HTTPS), przechowywania haseł
   wyłącznie w postaci skrótów kryptograficznych, kontroli dostępu do panelu administracyjnego
   oraz regularnych kopii zapasowych bazy danych;
4. pomagania Administratorowi w realizacji żądań osób, których dane dotyczą (art. 15–22 RODO),
   przez udostępnienie w panelu funkcji przeglądania, poprawiania i usuwania danych klienta;
5. pomagania Administratorowi w wywiązaniu się z obowiązków z art. 32–36 RODO;
6. zgłaszania Administratorowi naruszenia ochrony danych bez zbędnej zwłoki, nie później niż
   w ciągu **24 godzin** od jego stwierdzenia;
7. udostępniania Administratorowi informacji niezbędnych do wykazania spełnienia obowiązków
   oraz umożliwienia audytu, po uprzednim uzgodnieniu terminu.

## §5. Dalsze powierzenie (podprzetwarzający)

1. Administrator wyraża ogólną zgodę na korzystanie przez Podmiot przetwarzający z usług
   dalszych podmiotów przetwarzających wymienionych w załączniku nr 1.
2. Podmiot przetwarzający informuje Administratora o zamierzonych zmianach na liście z
   wyprzedzeniem **14 dni**, dając możliwość wyrażenia sprzeciwu.
3. Podmiot przetwarzający nakłada na dalsze podmioty przetwarzające obowiązki tożsame z
   wynikającymi z niniejszej umowy i odpowiada za ich działania jak za własne.

## §6. Lokalizacja przetwarzania

Dane przetwarzane są na terenie Europejskiego Obszaru Gospodarczego. Przekazanie danych poza
EOG wymaga uprzedniej pisemnej zgody Administratora oraz zastosowania mechanizmu z rozdziału V
RODO.

## §7. Odpowiedzialność

Podmiot przetwarzający odpowiada za szkody spowodowane przetwarzaniem niezgodnym z niniejszą
umową lub z RODO, na zasadach określonych w art. 82 RODO.

## §8. Zakończenie umowy

Po zakończeniu świadczenia usługi Podmiot przetwarzający, zależnie od wyboru Administratora
wyrażonego na piśmie w terminie 30 dni:

1. wyda Administratorowi kopię danych w formacie umożliwiającym ich odczyt (eksport bazy), oraz
2. usunie dane wraz z istniejącymi kopiami, chyba że obowiązek dalszego przechowywania wynika z
   przepisów prawa.

Brak dyspozycji w terminie 30 dni oznacza polecenie usunięcia danych.

## §9. Postanowienia końcowe

1. Zmiany umowy wymagają formy pisemnej albo dokumentowej (e-mail) pod rygorem nieważności.
2. W sprawach nieuregulowanych stosuje się RODO oraz przepisy prawa polskiego.
3. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach.

---

**Administrator**  ......................................

**Podmiot przetwarzający**  ......................................

---

## Załącznik nr 1 — dalsze podmioty przetwarzające

Uzupełnij zgodnie z tym, czego faktycznie używasz. Przykład dla wdrożenia na Vercelu:

| Podmiot | Rola | Lokalizacja |
| --- | --- | --- |
| [Dostawca hostingu, np. Vercel Inc.] | hosting aplikacji | [region UE] |
| [Dostawca bazy danych, np. Neon / Supabase] | przechowywanie bazy | [region UE] |
| [Dostawca poczty, np. Resend] | wysyłka powiadomień e-mail | [region] |

> Uwaga: jeśli którykolwiek dostawca przetwarza dane poza EOG, wymaga to uzupełnienia §6 i
> wskazania podstawy transferu (standardowe klauzule umowne). Przy wyborze regionu hostingu
> najprościej trzymać wszystko w UE i uniknąć tematu.

## Załącznik nr 2 — środki bezpieczeństwa

Stan faktyczny systemu na dziś, do aktualizacji przy każdej zmianie:

- połączenie szyfrowane HTTPS,
- hasła do paneli zapisane jako skróty scrypt z losową solą, nieodwracalne,
- sesje w ciasteczkach `httpOnly` podpisanych kluczem aplikacji,
- dostęp do panelu warsztatu ograniczony do jednego konta na warsztat,
- panel operatora chroniony osobnym hasłem i osobną sesją,
- automatyczna anonimizacja danych po okresie retencji ustawionym przez Administratora
  (domyślnie 24 miesiące),
- ograniczenie liczby zgłoszeń z jednego numeru telefonu i adresu IP,
- adres IP zgłaszającego przechowywany wyłącznie w postaci skrótu HMAC.
