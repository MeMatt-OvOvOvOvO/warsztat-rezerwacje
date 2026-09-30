import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildBookingIcs } from "@/lib/ics";
import { appUrl } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Plik kalendarza dla jednej rezerwacji.
 *
 * Adres jest chroniony tym samym tokenem co strona statusu wizyty, więc nie
 * trzeba się logować — wystarczy link z maila. Kalendarz Apple na iPhonie
 * otwiera go od razu w podglądzie „Dodaj wydarzenie”.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; token: string }> },
) {
  const { slug, token } = await params;

  const booking = await db.booking.findUnique({
    where: { manageToken: token },
    include: { workshop: true, service: true },
  });

  if (!booking || booking.workshop.slug !== slug) {
    return new NextResponse("Nie znaleziono rezerwacji.", { status: 404 });
  }

  const ics = buildBookingIcs({
    uid: `${booking.manageToken}@rezerwacje-warsztatowe`,
    startAt: booking.startAt,
    endAt: booking.endAt,
    updatedAt: booking.updatedAt,
    serviceName: booking.service.name,
    workshopName: booking.workshop.name,
    workshopPhone: booking.workshop.phone,
    workshopAddress: booking.workshop.address,
    carModel: booking.carModel,
    status: booking.status,
    manageUrl: appUrl(`/w/${slug}/rezerwacja/${token}`),
    alarmHoursBefore: booking.workshop.reminderHoursBefore,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wizyta.ics"',
      "Cache-Control": "no-store",
    },
  });
}
