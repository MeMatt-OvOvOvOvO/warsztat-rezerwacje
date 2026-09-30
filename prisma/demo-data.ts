/**
 * Dane demonstracyjne dla `npm run setup`.
 *
 * Trzymane osobno od skryptu, żeby dało się je sprawdzić testem bez bazy —
 * testy w tests/logic.test.ts pilnują, czy wizyty mieszczą się w godzinach
 * pracy i czy indeksy usług wskazują na istniejące pozycje.
 */

/* ------------------------------------------------------------------ */
/* Dane demonstracyjne                                                  */
/*                                                                      */
/* Trzy warsztaty celowo różnią się wszystkim, co wpływa na kalendarz   */
/* i na panel operatora: liczbą stanowisk, długością usług, statusem    */
/* abonamentu i tym, czy mają włączone SMS-y. Dzięki temu da się        */
/* przeklikać skrajne przypadki bez ręcznego klikania w ustawieniach.   */
/* ------------------------------------------------------------------ */

export type SampleService = {
  name: string;
  description: string | null;
  durationMin: number;
  priceFrom: number | null;
  active?: boolean;
};

export type SampleBooking = {
  /** przesunięcie w dniach względem dzisiaj; ujemne = przeszłość */
  dayOffset: number;
  minutes: number;
  service: number; // indeks w tablicy usług
  status: "PENDING" | "PROPOSED" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "DONE";
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  carModel: string;
  carPlate: string | null;
  notes?: string | null;
  source?: "ONLINE" | "PHONE";
  /** dla statusu PROPOSED: o której klient pierwotnie chciał przyjechać */
  originalMinutes?: number;
  workshopNote?: string;
};

export type SampleWorkshop = {
  slug: string;
  name: string;
  password: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  bays: number;
  slotStepMin: number;
  leadTimeHours: number;
  maxAdvanceDays: number;
  subscriptionStatus: "TRIAL" | "ACTIVE" | "SUSPENDED";
  /** za ile dni kończy się okres; ujemne = już po terminie */
  subscriptionInDays: number;
  monthlyPricePln: number;
  adminNote: string | null;
  remindersEnabled: boolean;
  reminderHoursBefore: number;
  smsEnabled: boolean;
  /** pon-pt, sobota; niedziela zawsze zamknięta */
  hours: { weekdayOpen: number; weekdayClose: number; satOpen: number; satClose: number; satClosed: boolean };
  services: SampleService[];
  bookings: SampleBooking[];
};

export const WORKSHOPS: SampleWorkshop[] = [
  /* ---------------- 1. typowy warsztat na okresie próbnym ---------------- */
  {
    slug: "demo",
    name: "Auto-Serwis Kowalski",
    password: "demo1234",
    phone: "600 100 200",
    email: "warsztat@example.com",
    address: "ul. Warsztatowa 12, 01-234 Warszawa",
    bays: 2,
    slotStepMin: 30,
    leadTimeHours: 2,
    maxAdvanceDays: 60,
    subscriptionStatus: "TRIAL",
    subscriptionInDays: 21,
    monthlyPricePln: 150,
    adminNote: "Warsztat demonstracyjny z danymi startowymi.",
    remindersEnabled: true,
    reminderHoursBefore: 24,
    smsEnabled: false,
    hours: { weekdayOpen: 8 * 60, weekdayClose: 17 * 60, satOpen: 9 * 60, satClose: 13 * 60, satClosed: false },
    services: [
      { name: "Wymiana klocków hamulcowych", description: "Jedna oś, klocki klienta lub nasze", durationMin: 90, priceFrom: 150 },
      { name: "Wymiana opon", description: "Komplet 4 kół, wyważanie w cenie", durationMin: 60, priceFrom: 160 },
      { name: "Wymiana oleju i filtrów", description: "Olej, filtr oleju, filtr powietrza", durationMin: 60, priceFrom: 120 },
      { name: "Przegląd okresowy", description: "Kontrola zawieszenia, hamulców, płynów", durationMin: 120, priceFrom: 250 },
      { name: "Diagnostyka komputerowa", description: "Odczyt błędów i konsultacja", durationMin: 45, priceFrom: 100 },
      { name: "Detailing — korekta lakieru", description: "Jednoetapowa korekta + zabezpieczenie", durationMin: 480, priceFrom: 900 },
    ],
    bookings: [
      {
        dayOffset: 1, minutes: 9 * 60, service: 0, status: "PENDING",
        customerName: "Marek Zieliński", customerPhone: "601 234 567",
        customerEmail: "marek.zielinski@example.com",
        carModel: "Skoda Octavia 1.6 TDI", carPlate: "WX 12345",
        notes: "Piszczy przy hamowaniu, przód.",
      },
      {
        // potwierdzona na jutro — na niej przetestujesz `npm run przypomnienia`
        dayOffset: 1, minutes: 13 * 60, service: 2, status: "CONFIRMED",
        customerName: "Anna Nowak", customerPhone: "602 345 678",
        customerEmail: "anna.nowak@example.com",
        carModel: "Toyota Yaris 1.0", carPlate: "WB 98765",
      },
      {
        dayOffset: 2, minutes: 10 * 60, service: 1, status: "PENDING",
        customerName: "Piotr Wójcik", customerPhone: "603 456 789", customerEmail: null,
        carModel: "Ford Focus Mk3", carPlate: "WA 55512", notes: "Opony mam swoje.",
      },
      {
        // warsztat zaproponował inny termin i czeka na odpowiedź klienta
        dayOffset: 3, minutes: 15 * 60, service: 3, status: "PROPOSED",
        originalMinutes: 8 * 60,
        workshopNote: "O ósmej mamy już dwa auta na podnośnikach, proponuję po południu.",
        customerName: "Ewa Kamińska", customerPhone: "605 111 222",
        customerEmail: "ewa.kaminska@example.com",
        carModel: "Opel Astra J", carPlate: "WE 41200",
      },
      {
        dayOffset: -7, minutes: 11 * 60, service: 3, status: "DONE",
        customerName: "Marek Zieliński", customerPhone: "601 234 567",
        customerEmail: "marek.zielinski@example.com",
        carModel: "Skoda Octavia 1.6 TDI", carPlate: "WX 12345",
      },
      {
        dayOffset: 2, minutes: 14 * 60, service: 4, status: "CONFIRMED", source: "PHONE",
        customerName: "Katarzyna Lis", customerPhone: "604 567 890", customerEmail: null,
        carModel: "Volkswagen Golf VII", carPlate: "WI 33221",
        notes: "Dzwoniła, kontrolka silnika.",
      },
    ],
  },

  /* ---------------- 2. jednoosobowy detailing: jedno stanowisko, długie usługi ---------------- */
  {
    slug: "detailing-wola",
    name: "Detailing Studio Wola",
    password: "wola1234",
    phone: "605 900 100",
    email: "kontakt@detailingwola.example.com",
    address: "ul. Kasprzaka 8, 01-211 Warszawa",
    bays: 1, // jeden człowiek, jedno auto naraz — idealne do testu kolizji
    slotStepMin: 60,
    leadTimeHours: 24, // nie przyjmuje „na już”
    maxAdvanceDays: 90,
    subscriptionStatus: "ACTIVE",
    subscriptionInDays: 12,
    monthlyPricePln: 199,
    adminNote: "Płaci przelewem 10. dnia miesiąca. Prosił o SMS-y.",
    remindersEnabled: true,
    reminderHoursBefore: 48,
    smsEnabled: true, // jedyny warsztat z włączonymi SMS-ami
    hours: { weekdayOpen: 9 * 60, weekdayClose: 18 * 60, satOpen: 10 * 60, satClose: 14 * 60, satClosed: false },
    services: [
      { name: "Korekta lakieru jednoetapowa", description: "Maszynowa korekta + wosk", durationMin: 360, priceFrom: 900 },
      { name: "Korekta dwuetapowa z powłoką", description: "Pełny dzień na stanowisku", durationMin: 480, priceFrom: 2200 },
      { name: "Detailing wnętrza", description: "Pranie tapicerki, skóry, plastiki", durationMin: 300, priceFrom: 600 },
      { name: "Mycie detailingowe", description: "Dwuwiaderkowe, dekontaminacja, quick wax", durationMin: 120, priceFrom: 180 },
      { name: "Powłoka na szyby", description: "Niewidzialna wycieraczka", durationMin: 60, priceFrom: 150, active: false },
    ],
    bookings: [
      {
        dayOffset: 2, minutes: 9 * 60, service: 1, status: "CONFIRMED",
        customerName: "Tomasz Bąk", customerPhone: "606 700 800",
        customerEmail: "tomasz.bak@example.com",
        carModel: "BMW 330i G20", carPlate: "WD 70707",
        notes: "Auto po zimie, sporo swirli na masce.",
      },
      {
        dayOffset: 4, minutes: 10 * 60, service: 0, status: "PENDING",
        customerName: "Magdalena Sowa", customerPhone: "607 123 456",
        customerEmail: "m.sowa@example.com",
        carModel: "Audi A4 B9", carPlate: "WB 22110",
      },
      {
        dayOffset: -3, minutes: 9 * 60, service: 2, status: "DONE",
        customerName: "Tomasz Bąk", customerPhone: "606 700 800",
        customerEmail: "tomasz.bak@example.com",
        carModel: "BMW 330i G20", carPlate: "WD 70707",
      },
      {
        // odrzucone — do testu widoku „odrzucona” u klienta
        dayOffset: 5, minutes: 9 * 60, service: 1, status: "REJECTED",
        workshopNote: "Na ten tydzień mam komplet, zapraszam za dwa tygodnie.",
        customerName: "Rafał Adamczyk", customerPhone: "608 999 000", customerEmail: null,
        carModel: "Mazda 6", carPlate: "WW 10101",
      },
    ],
  },

  /* ---------------- 3. wulkanizacja: trzy stanowiska, krótkie usługi, abonament wstrzymany ---------------- */
  {
    slug: "wulkanizacja-mokotow",
    name: "Wulkanizacja Mokotów",
    password: "opony1234",
    phone: "22 843 55 66",
    email: null, // celowo bez maila: sprawdzisz, jak zachowują się powiadomienia
    address: "ul. Puławska 145, 02-715 Warszawa",
    bays: 3, // trzy stanowiska — tu widać różnicę w liczeniu pojemności
    slotStepMin: 15,
    leadTimeHours: 0, // wjazd z ulicy
    maxAdvanceDays: 30,
    subscriptionStatus: "SUSPENDED", // strona rezerwacji jest wyłączona
    subscriptionInDays: -18,
    monthlyPricePln: 150,
    adminNote: "Nie zapłacił za wrzesień, dwa razy przypominałem. Wstrzymane.",
    remindersEnabled: false,
    reminderHoursBefore: 24,
    smsEnabled: false,
    hours: { weekdayOpen: 7 * 60, weekdayClose: 19 * 60, satOpen: 8 * 60, satClose: 15 * 60, satClosed: false },
    services: [
      { name: "Wymiana opon — komplet", description: "4 koła, wyważanie w cenie", durationMin: 45, priceFrom: 140 },
      { name: "Wymiana opon z felgami", description: "Przełożenie kompletnych kół", durationMin: 20, priceFrom: 80 },
      { name: "Naprawa przebitej opony", description: "Wkład lub łata od wewnątrz", durationMin: 30, priceFrom: 60 },
      { name: "Wyważanie kół", description: "Komplet 4 kół", durationMin: 30, priceFrom: 80 },
      { name: "Przechowanie opon", description: "Sezon, magazyn ogrzewany", durationMin: 15, priceFrom: 120 },
    ],
    bookings: [
      {
        dayOffset: 1, minutes: 8 * 60, service: 0, status: "CONFIRMED", source: "PHONE",
        customerName: "Jan Mazur", customerPhone: "609 300 400", customerEmail: null,
        carModel: "Dacia Duster", carPlate: "WM 88991",
      },
      {
        dayOffset: 1, minutes: 8 * 60, service: 1, status: "CONFIRMED", source: "PHONE",
        customerName: "Agnieszka Król", customerPhone: "609 500 600", customerEmail: null,
        carModel: "Fiat Tipo", carPlate: "WN 12120",
      },
      {
        // trzecia wizyta o tej samej godzinie — zapełnia wszystkie stanowiska
        dayOffset: 1, minutes: 8 * 60, service: 2, status: "CONFIRMED",
        customerName: "Łukasz Nowicki", customerPhone: "609 700 800",
        customerEmail: "l.nowicki@example.com",
        carModel: "Renault Clio IV", carPlate: "WP 45678",
        notes: "Gwóźdź w tylnej prawej.",
      },
      {
        dayOffset: -1, minutes: 16 * 60, service: 3, status: "CANCELLED",
        customerName: "Beata Sikora", customerPhone: "609 111 333", customerEmail: null,
        carModel: "Hyundai i30", carPlate: "WR 30303",
      },
      {
        dayOffset: -14, minutes: 10 * 60, service: 0, status: "DONE", source: "PHONE",
        customerName: "Jan Mazur", customerPhone: "609 300 400", customerEmail: null,
        carModel: "Dacia Duster", carPlate: "WM 88991",
      },
    ],
  },
];
