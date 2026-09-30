/**
 * Warstwa powiadomień.
 *
 * Domyślnie wypisuje wiadomość w konsoli serwera - dzięki temu cała aplikacja
 * działa bez zakładania jakiegokolwiek konta. Jeśli w .env pojawi się
 * RESEND_API_KEY, ta sama funkcja wyśle prawdziwego maila.
 *
 * Miejsce na SMS (Twilio) jest przygotowane w sendSms() - patrz etap 3 planu.
 */

type Mail = {
  to: string | null | undefined;
  subject: string;
  text: string;
};

export async function sendMail({ to, subject, text }: Mail): Promise<void> {
  if (!to) return;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(
      ["", "──────── MAIL (tryb testowy) ────────", `do:     ${to}`, `temat:  ${subject}`, "", text, "─────────────────────────────────────", ""].join(
        "\n",
      ),
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "Rezerwacje <onboarding@resend.dev>",
        to: [to],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      console.error("Nie udało się wysłać maila:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Błąd wysyłki maila:", err);
  }
}

/**
 * SMS przez Twilio.
 *
 * Bez kluczy w .env treść trafia do konsoli — tak jak maile, żeby cała ścieżka
 * dała się przetestować bez zakładania konta i bez wydawania pieniędzy.
 *
 * Numer musi być w formacie E.164 (patrz src/lib/phone.ts). Zwraca true, gdy
 * wiadomość została przyjęta przez bramkę — dzwoniący decyduje, co z porażką.
 */
export async function sendSms(to: string | null | undefined, text: string): Promise<boolean> {
  if (!to) return false;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const messagingService = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!sid || !token || (!from && !messagingService)) {
    console.log(
      ["", "──────── SMS (tryb testowy) ────────", `do:   ${to}`, "", text, "────────────────────────────────────", ""].join(
        "\n",
      ),
    );
    return true;
  }

  const body = new URLSearchParams({ To: to, Body: text });
  if (messagingService) body.set("MessagingServiceSid", messagingService);
  else if (from) body.set("From", from);

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      console.error("Nie udało się wysłać SMS-a:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Błąd wysyłki SMS:", err);
    return false;
  }
}

export function appUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
