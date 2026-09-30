#!/usr/bin/env node
/**
 * Przełącznik bazy w schemacie Prismy: SQLite (lokalnie) ↔ PostgreSQL (produkcja).
 *
 *   npm run db:postgres   — przed wdrożeniem
 *   npm run db:sqlite     — z powrotem do pracy na laptopie
 *
 * Prisma wymaga, żeby `provider` był wpisany w schemacie na sztywno — nie da się
 * go podać zmienną środowiskową. Zamiast trzymać dwa schematy, które prędzej czy
 * później się rozjadą, podmieniamy jedną linijkę.
 *
 * Przy Postgresie dokładamy `directUrl`. Vercel łączy się z bazą przez pulę
 * połączeń (adres z „-pooler”), ale migracje muszą iść połączeniem bezpośrednim —
 * bez tego `prisma db push` potrafi się zawiesić.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SCHEMA = "prisma/schema.prisma";
const target = process.argv[2];

if (target !== "sqlite" && target !== "postgresql") {
  console.error("  Użycie: node scripts/provider.mjs sqlite|postgresql");
  process.exit(1);
}

let schema = readFileSync(SCHEMA, "utf8");
const current = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/)?.[1];

if (!current) {
  console.error(`  Nie znalazłem linijki z providerem w ${SCHEMA}.`);
  process.exit(1);
}

schema = schema.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${target}"`);

// directUrl tylko dla Postgresa
schema = schema.replace(/\n\s*directUrl\s*=\s*env\("DIRECT_URL"\)/, "");
if (target === "postgresql") {
  schema = schema.replace(
    /(url\s*=\s*env\("DATABASE_URL"\))/,
    '$1\n  directUrl = env("DIRECT_URL")',
  );
}

writeFileSync(SCHEMA, schema);

console.log("");
if (current === target) {
  console.log(`  Schemat już był ustawiony na ${target}.`);
} else {
  console.log(`  Schemat przełączony: ${current} → ${target}`);
}

if (target === "postgresql") {
  console.log("");
  console.log("  Pamiętaj o zmiennych:");
  console.log("    DATABASE_URL  — adres z puli połączeń (z „-pooler” w nazwie)");
  console.log("    DIRECT_URL    — adres bezpośredni, do migracji");
  console.log("");
  console.log("  Potem: npx prisma db push");
} else {
  console.log("  DATABASE_URL powinien wskazywać plik, np. file:./dev.db");
}
console.log("");
