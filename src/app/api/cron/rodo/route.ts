import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { runRetention } from "@/lib/privacy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const report = await runRetention();
  const total = report.reduce((sum, r) => sum + r.anonymized, 0);
  return NextResponse.json({ anonymized: total, workshops: report });
}
