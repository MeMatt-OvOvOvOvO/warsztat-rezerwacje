"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Warsztaty" },
  { href: "/admin/nowy", label: "Dodaj warsztat" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {ITEMS.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
