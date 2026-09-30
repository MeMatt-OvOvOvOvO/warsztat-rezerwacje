# RODO — co system robi sam, a co należy do Ciebie

> Nie jest to opinia prawna. To lista tego, co zostało zaimplementowane, i tego, co trzeba
> jeszcze załatwić poza kodem, zanim system trafi do pierwszego płacącego warsztatu.

## Kto jest kim

- **Administratorem** danych klienta jest **warsztat** — to on decyduje, po co zbiera numer
  telefonu i historię napraw.
- **Podmiotem przetwarzającym** jesteś **Ty jako dostawca systemu** — przetwarzasz te dane
  wyłącznie po to, żeby usługa działała.
- Dlatego klauzula informacyjna na stronie rezerwacji wskazuje warsztat, a Ty podpisujesz z nim
  umowę powierzenia (wzór: `docs/umowa-powierzenia.md`).

## Co system już robi

| Wymóg | Gdzie w kodzie |
| --- | --- |
| Klauzula informacyjna (art. 13 RODO) | `/w/<slug>/prywatnosc` — składana z danych warsztatu |
| Potwierdzenie zapoznania się z klauzulą | checkbox w formularzu; bez niego zgłoszenia nie da się wysłać |
| Dowód, kiedy klient je złożył | pole `consentAt` na rezerwacji |
| Ograniczenie zakresu danych | wymagane tylko imię, telefon i auto; e-mail i rejestracja opcjonalne |
| Prawo do usunięcia danych (art. 17) | panel → Klienci → „Usuń dane tego klienta” (anonimizacja) |
| Ograniczenie czasu przechowywania (art. 5 ust. 1 lit. e) | `retentionMonths` w ustawieniach + `npm run rodo:cleanup` |
| Minimalizacja danych technicznych | adres IP zapisywany wyłącznie jako skrót HMAC |
| Bezpieczeństwo haseł | scrypt z losową solą, hasła nieodwracalne |

### Anonimizacja zamiast kasowania

Usunięcie danych nie kasuje rezerwacji — czyści z niej imię, telefon, e-mail, auto i uwagi,
zostawiając usługę, termin i status. Powód: warsztat ma prawo wiedzieć, ile wizyt wykonał, a
zanonimizowany rekord przestaje być daną osobową. Gdyby kasować całe rezerwacje, znikałaby
historia przychodu i statystyki obłożenia.

## Co musisz zrobić poza kodem

1. **Podpisać umowę powierzenia z każdym warsztatem.** Bez niej przetwarzasz dane bez podstawy.
   Wzór jest gotowy — wypełnij załącznik nr 1 listą swoich dostawców.
2. **Ustawić retencję razem z warsztatem.** Domyślne 24 miesiące to rozsądny kompromis, ale to
   Administrator, czyli warsztat, decyduje.
3. **Uruchomić `rodo:cleanup` cyklicznie.** Dziś odpalasz go ręcznie. Po wdrożeniu na serwer
   ustaw zadanie codzienne — inaczej deklaracja z klauzuli informacyjnej jest pusta.
4. **Zadbać o kopie zapasowe i ich kasowanie.** Kopia sprzed roku zawierająca dane, które
   skasowałeś na żądanie klienta, to ten sam problem od nowa.
5. **Sprawdzić, gdzie stoją serwery.** Najprościej trzymać hosting i bazę w regionie UE i nie
   otwierać tematu transferu poza EOG.
6. **Prowadzić rejestr czynności przetwarzania** (art. 30 RODO) — jako podmiot przetwarzający
   masz obowiązek prowadzić rejestr kategorii czynności wykonywanych w imieniu administratorów.
7. **Mieć procedurę na naruszenie.** Umowa mówi o 24 godzinach na zgłoszenie warsztatowi —
   warto z góry wiedzieć, kto to robi i jak.
8. **Dać całość do przejrzenia prawnikowi** przed pierwszą fakturą.

## Czego świadomie nie ma

- **Zgody marketingowej** — system nie wysyła niczego poza obsługą konkretnej wizyty, więc nie
  ma czego zbierać. Gdy dojdą przypomnienia o kolejnym przeglądzie, trzeba to przemyśleć od
  nowa: to już może być marketing, a nie wykonanie umowy.
- **Eksportu danych klienta na żądanie (art. 20)** — dziś realizujesz to ręcznie, pokazując
  historię w panelu. Przy większej skali warto dodać przycisk generujący plik.
- **Rejestru dostępu do danych** — nie wiadomo, kto i kiedy oglądał kartę klienta. Przy jednym
  koncie na warsztat ma to ograniczony sens, ale przy koncie dla każdego mechanika już nie.
