"use client";

import { useEffect, useState } from "react";

/**
 * Przełącznik motywu: system / jasny / ciemny.
 *
 * Sam motyw robi CSS — tutaj tylko ustawiamy atrybut data-theme na <html>
 * i zapamiętujemy wybór. Brak atrybutu oznacza „jak w systemie”, dzięki czemu
 * domyślne zachowanie działa też u kogoś, kto nigdy tego nie dotknie.
 *
 * Migotanie przy wczytywaniu strony rozwiązuje skrypt w src/app/layout.tsx,
 * który ustawia atrybut jeszcze przed pierwszym malowaniem.
 */

type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "warsztat-motyw";

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "Motyw jak w systemie",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "light",
    label: "Motyw jasny",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18L3.05 3.05"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Motyw ciemny",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // prywatne okno albo zablokowane ciasteczka — zostaje ustawienie systemu
    }
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;

    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);

    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // wybór zadziała do końca sesji, tylko się nie zapamięta
    }
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Motyw kolorystyczny">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          aria-label={o.label}
          aria-pressed={theme === o.value}
          onClick={() => apply(o.value)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
