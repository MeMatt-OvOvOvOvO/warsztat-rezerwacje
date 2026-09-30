/**
 * Nazwy pól używane po obu stronach — w komponencie klienckim i w walidacji na serwerze.
 * Trzymane osobno, bo src/lib/antispam.ts sięga po node:crypto i nie wejdzie do bundla klienta.
 */

/** Pole-pułapka: ukryte przed człowiekiem, wypełniane odruchowo przez boty. */
export const HONEYPOT_FIELD = "firma";
