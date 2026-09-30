import Link from "next/link";
import { isAdminLoggedIn } from "@/lib/admin";
import { adminLogout } from "@/app/actions/admin";
import AdminNav from "./AdminNav";
import ThemeToggle from "@/app/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminLoggedIn())) return <>{children}</>;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/admin">
            <span className="brand-mark">OP</span>
            Panel operatora
          </Link>
          <AdminNav />
          <ThemeToggle />
          <form action={adminLogout}>
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
