export type BookingStatusValue =
  | "PENDING"
  | "PROPOSED"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "DONE";

export const STATUS_LABEL: Record<BookingStatusValue, string> = {
  PENDING: "Oczekuje na potwierdzenie",
  PROPOSED: "Zaproponowano inny termin",
  CONFIRMED: "Potwierdzona",
  REJECTED: "Odrzucona",
  CANCELLED: "Odwołana",
  DONE: "Zrealizowana",
};

export const STATUS_SHORT: Record<BookingStatusValue, string> = {
  PENDING: "Oczekuje",
  PROPOSED: "Inny termin",
  CONFIRMED: "Potwierdzona",
  REJECTED: "Odrzucona",
  CANCELLED: "Odwołana",
  DONE: "Zrealizowana",
};

export function statusClass(status: string): string {
  return `badge badge-${status.toLowerCase()}`;
}
