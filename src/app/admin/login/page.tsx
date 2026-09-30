import { redirect } from "next/navigation";
import { isAdminConfigured, isAdminLoggedIn } from "@/lib/admin";
import { adminLogin } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdminLoggedIn()) redirect("/admin");
  const { error } = await searchParams;
  const configured = isAdminConfigured();

  return (
    <main
      className="page"
      style={{ maxWidth: 420, minHeight: "100dvh", display: "grid", alignContent: "center" }}
    >
      <div className="center mb">
        <span className="brand-mark" style={{ width: 40, height: 40, fontSize: 14, margin: "0 auto" }}>
          OP
        </span>
        <h1 className="mt">Panel operatora</h1>
        <p className="muted">Zakładanie i obsługa warsztatów korzystających z systemu.</p>
      </div>

      {!configured ? (
        <div className="card">
          <div className="alert alert-error" style={{ marginBottom: 0 }}>
            Panel operatora jest wyłączony. Dopisz <strong>ADMIN_PASSWORD</strong> do pliku{" "}
            <span className="mono">.env</span> i zrestartuj serwer.
          </div>
        </div>
      ) : (
        <form className="card" action={adminLogin}>
          {error && <div className="alert alert-error">Nieprawidłowe hasło.</div>}

          <div className="field">
            <label htmlFor="password">Hasło operatora</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              autoFocus
            />
            <div className="hint">To nie jest hasło do panelu warsztatu.</div>
          </div>

          <button className="btn btn-primary btn-block mt" type="submit">
            Zaloguj
          </button>
        </form>
      )}
    </main>
  );
}
