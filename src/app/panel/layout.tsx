import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentWorkshop } from "@/lib/auth";
import { isAdminLoggedIn } from "@/lib/admin";
import { endImpersonation } from "@/app/actions/admin";
import { logout } from "@/app/actions/panel";
import { initials } from "@/lib/text";
import PanelNav from "./PanelNav";
import ThemeToggle from "@/app/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const workshop = await getCurrentWorkshop();

  if (!workshop) return <>{children}</>;

  const [pendingCount, asOperator] = await Promise.all([
    db.booking.count({ where: { workshopId: workshop.id, status: "PENDING" } }),
    isAdminLoggedIn(),
  ]);

  return (
    <>
      {asOperator && (
        <div className="banner">
          <span>
            Oglądasz panel warsztatu <strong>{workshop.name}</strong> jako operator systemu.
          </span>
          <form action={endImpersonation}>
            <button className="btn btn-sm" type="submit">
              Zakończ podgląd
            </button>
          </form>
        </div>
      )}
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/panel">
            <span className="brand-mark">{initials(workshop.name)}</span>
            {workshop.name}
          </Link>
          <PanelNav pendingCount={pendingCount} />
          <ThemeToggle />
          <form action={logout}>
            <button className="btn btn-sm" type="submit">
              Wyloguj
            </button>
          </form>
        </div>
      </header>
      <div className="page-wide">{children}</div>
    </>
  );
}
