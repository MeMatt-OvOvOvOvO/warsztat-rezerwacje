import { redirect } from "next/navigation";
import { getSessionWorkshopId } from "@/lib/auth";
import { login } from "@/app/actions/panel";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSessionWorkshopId()) redirect("/panel");
  const { error } = await searchParams;

  return (
    <main
      className="page"
      style={{ maxWidth: 420, minHeight: "100dvh", display: "grid", alignContent: "center" }}
    >
      <div className="center mb">
        <span className="brand-mark" style={{ width: 40, height: 40, fontSize: 16, margin: "0 auto" }}>
          R
        </span>
        <h1 className="mt">Panel warsztatu</h1>
        <p className="muted">Zaloguj się, żeby zobaczyć zgłoszenia i kalendarz.</p>
      </div>

      <form className="card" action={login}>
        {error && <div className="alert alert-error">Nieprawidłowy identyfikator lub hasło.</div>}

        <div className="field">
          <label htmlFor="slug">Identyfikator warsztatu</label>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="demo"
          />
          <div className="hint">Ta sama nazwa, która występuje w Twoim linku rezerwacyjnym.</div>
        </div>

        <div className="field">
          <label htmlFor="password">Hasło</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>

        <button className="btn btn-primary btn-block mt" type="submit">
          Zaloguj
        </button>
      </form>
    </main>
  );
}
