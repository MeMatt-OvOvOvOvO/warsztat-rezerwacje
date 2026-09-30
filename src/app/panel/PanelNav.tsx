"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/panel", label: "Zgłoszenia" },
  { href: "/panel/nowa-wizyta", label: "Nowa wizyta" },
  { href: "/panel/kalendarz", label: "Kalendarz" },
  { href: "/panel/klienci", label: "Klienci" },
  { href: "/panel/ustawienia", label: "Ustawienia" },
];

export default function PanelNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {ITEMS.map((item) => {
        const active = item.href === "/panel" ? pathname === "/panel" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
            {item.label}
            {item.href === "/panel" && pendingCount > 0 && (
              <span className="badge badge-count" style={{ marginLeft: 6 }}>
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
