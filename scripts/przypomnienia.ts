/**
 * Wysyłka przypomnień o zbliżających się wizytach.
 *
 * Uruchomienie ręczne:  npm run przypomnienia
 * Docelowo: co godzinę zadaniem cron (na Vercelu robi to /api/cron/przypomnienia).
 */
import { sendDueReminders } from "../src/lib/reminders";
import { db } from "../src/lib/db";

async function main() {
  const report = await sendDueReminders();

  console.log("");
  console.log("  Przypomnienia o wizytach");
  console.log("  ─────────────────────────────────────────");
  for (const line of report.lines) console.log(`  ${line}`);
  if (report.lines.length === 0) console.log("  Brak wizyt do przypomnienia.");
  console.log("  ─────────────────────────────────────────");
  console.log(`  Wysłane: ${report.sent} (SMS: ${report.sms}, mail: ${report.mail})`);
  if (report.skipped > 0) console.log(`  Pominięte: ${report.skipped}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
