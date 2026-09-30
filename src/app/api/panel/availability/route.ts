import { NextRequest, NextResponse } from "next/server";
import { getSessionWorkshopId } from "@/lib/auth";
import { getAvailability } from "@/lib/availability";
import { dateKey, nowWall } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Dostępność dla panelu warsztatu.
 *
 * Różni się od publicznej tym, że ignoruje minimalne wyprzedzenie — właściciel
 * musi móc wpisać wizytę „na teraz”, bo klient stoi właśnie przy ladzie.
 */
export async function GET(req: NextRequest) {
  const workshopId = await getSessionWorkshopId();
  if (!workshopId) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const serviceId = params.get("service");
  const from = params.get("from") || dateKey(nowWall());
  const days = Math.min(Number(params.get("days") || 14), 31);

  if (!serviceId) {
    return NextResponse.json({ error: "Brak usługi." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: "Nieprawidłowa data." }, { status: 400 });
  }

  const availability = await getAvailability({
    workshopId,
    serviceId,
    from,
    days,
    ignoreLeadTime: true,
  });

  return NextResponse.json({ days: availability });
}
