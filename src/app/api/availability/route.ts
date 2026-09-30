import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvailability } from "@/lib/availability";
import { dateKey, nowWall } from "@/lib/time";
import { isBookingEnabled } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const slug = params.get("slug");
  const serviceId = params.get("service");
  const from = params.get("from") || dateKey(nowWall());
  const days = Math.min(Number(params.get("days") || 14), 31);

  if (!slug || !serviceId) {
    return NextResponse.json({ error: "Brak wymaganych parametrów." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: "Nieprawidłowa data." }, { status: 400 });
  }

  const workshop = await db.workshop.findUnique({
    where: { slug },
    select: { id: true, subscriptionStatus: true },
  });
  if (!workshop) {
    return NextResponse.json({ error: "Nie znaleziono warsztatu." }, { status: 404 });
  }
  if (!isBookingEnabled(workshop)) {
    return NextResponse.json({ days: [] });
  }

  const availability = await getAvailability({
    workshopId: workshop.id,
    serviceId,
    from,
    days,
  });

  return NextResponse.json({ days: availability });
}
