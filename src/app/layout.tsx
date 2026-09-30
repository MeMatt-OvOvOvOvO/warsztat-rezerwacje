import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rezerwacje warsztatowe",
  description: "System rezerwacji online dla warsztatów samochodowych i detailingu",
};

/**
 * Motyw ustawiamy przed pierwszym malowaniem strony.
 *
 * Gdyby robił to dopiero React, użytkownik z wybranym motywem ciemnym zobaczyłby
 * na ułamek sekundy białe tło przy każdym wejściu. Skrypt jest celowo malutki
 * i owinięty w try — w prywatnym oknie localStorage potrafi rzucić wyjątkiem.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('warsztat-motyw');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
