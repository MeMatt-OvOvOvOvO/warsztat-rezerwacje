/**
 * Kopia zapasowa bazy SQLite.
 *
 * Uruchomienie: npm run db:backup
 * Plik trafia do katalogu backups/ z datą w nazwie. Stare kopie kasujemy
 * po 30 sztukach, żeby katalog nie puchł w nieskończoność.
 *
 * Po przejściu na Postgresa ten skrypt przestaje mieć sens — tam kopie robi
 * dostawca bazy (Neon i Supabase mają je wbudowane), a to trzeba włączyć
 * i raz na jakiś czas sprawdzić, czy da się z nich odtworzyć dane.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const KEEP = 30;

function dbPath(): string {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  if (!url.startsWith("file:")) {
    console.error("  DATABASE_URL nie wskazuje na plik SQLite — kopie robi dostawca bazy.");
    process.exit(1);
  }
  return resolve("prisma", url.replace("file:", ""));
}

function main() {
  const source = dbPath();
  if (!existsSync(source)) {
    console.error(`  Nie znalazłem bazy: ${source}. Uruchom najpierw npm run setup.`);
    process.exit(1);
  }

  const dir = resolve("backups");
  mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const target = join(dir, `dev-${stamp}.db`);
  copyFileSync(source, target);

  const kept = readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse();

  for (const old of kept.slice(KEEP)) unlinkSync(join(dir, old));

  const size = (statSync(target).size / 1024).toFixed(0);
  console.log("");
  console.log(`  Kopia zapasowa: ${target} (${size} kB)`);
  console.log(`  Kopii w katalogu: ${Math.min(kept.length, KEEP)} z ${KEEP} przechowywanych.`);
  console.log("");
}

main();
