import { nowWall } from "./time";

export type SubscriptionStatusValue = "TRIAL" | "ACTIVE" | "SUSPENDED";

export const SUBSCRIPTION_LABEL: Record<SubscriptionStatusValue, string> = {
  TRIAL: "Okres próbny",
  ACTIVE: "Abonament aktywny",
  SUSPENDED: "Wstrzymany",
};

/** Klasa odznaki — mapujemy na te same style, których używają statusy rezerwacji. */
export function subscriptionClass(status: string): string {
  const map: Record<string, string> = {
    TRIAL: "badge badge-proposed",
    ACTIVE: "badge badge-confirmed",
    SUSPENDED: "badge badge-rejected",
  };
  return map[status] ?? "badge badge-done";
}

/**
 * Czy strona rezerwacji tego warsztatu ma działać.
 *
 * Celowo odcina wyłącznie status SUSPENDED. Minięcie daty w subscriptionUntil
 * niczego samo z siebie nie wyłącza — decyzję o odcięciu klienta podejmuje
 * operator, a nie zegar. Panel pokazuje takie warsztaty jako „po terminie”.
 */
export function isBookingEnabled(workshop: { subscriptionStatus: string }): boolean {
  return workshop.subscriptionStatus !== "SUSPENDED";
}

/** Ile dni zostało do końca okresu; ujemne = po terminie. Null gdy brak daty. */
export function daysLeft(until: Date | null): number | null {
  if (!until) return null;
  const ms = until.getTime() - nowWall().getTime();
  return Math.ceil(ms / 86_400_000);
}

/** Krótki opis terminu dla listy w panelu operatora. */
export function describeDeadline(until: Date | null): { text: string; overdue: boolean } {
  const left = daysLeft(until);
  if (left === null) return { text: "bez terminu", overdue: false };
  if (left < 0) return { text: `po terminie o ${Math.abs(left)} dni`, overdue: true };
  if (left === 0) return { text: "kończy się dziś", overdue: true };
  if (left === 1) return { text: "został 1 dzień", overdue: true };
  return { text: `zostało ${left} dni`, overdue: left <= 7 };
}
