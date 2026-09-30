/**
 * Sprzątanie danych po okresie retencji.
 *
 * Uruchomienie ręczne:   npm run rodo:cleanup
 * Docelowo: raz na dobę zadaniem cyklicznym (cron na serwerze albo Vercel Cron).
 *
 * Skrypt nie kasuje rezerwacji — czyści z nich dane osobowe. Warsztat zachowuje
 * informację, ile wizyt wykonał, a klient przestaje być w bazie rozpoznawalny.
 */
import { runRetention } from "../src/lib/privacy";
import { db } from "../src/lib/db";

async function main() {
  const report = await runRetention();
  const total = report.reduce((sum, r) => sum + r.anonymized, 0);

  console.log("");
  console.log("  Retencja danych — raport");
  console.log("  ─────────────────────────────────────────");
  for (const row of report) {
    console.log(`  ${row.workshop}: ${row.anonymized}`);
  }
  console.log("  ─────────────────────────────────────────");
  console.log(`  Zanonimizowano łącznie: ${total}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
