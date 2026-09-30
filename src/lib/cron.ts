import { timingSafeEqual } from "node:crypto";

/**
 * Zadania cykliczne wystawione jako adresy HTTP, żeby dały się odpalać
 * harmonogramem hostingu (Vercel Cron, cron-job.org, zwykły crontab z curl).
 *
 * Chroni je sekret z CRON_SECRET. Bez ustawionego sekretu adresy są zamknięte —
 * lepiej, żeby zadanie nie działało wcale, niż żeby ktoś obcy mógł je wołać.
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
