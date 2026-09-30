import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { sendDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const report = await sendDueReminders();
  return NextResponse.json({
    sent: report.sent,
    sms: report.sms,
    mail: report.mail,
    skipped: report.skipped,
  });
}
