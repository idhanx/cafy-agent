import localFont from "next/font/local";

// Body / UI / headings — Inter. The latin variable subset is vendored so an
// offline production build never contacts Google.
export const inter = localFont({
  src: [{
    path: "../assets/fonts/inter/Inter-Latin-Variable.woff2",
    weight: "100 900",
    style: "normal",
  }],
  variable: "--font-inter",
  display: "swap",
});

// Display type — bold, slightly condensed Titillium Web for headlines; Inter
// stays on body/UI (DESIGN.md: the font roles are fixed).
export const titillium = localFont({
  src: [
    { path: "../assets/fonts/titillium-web/titillium-web-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../assets/fonts/titillium-web/titillium-web-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-titillium",
  display: "swap",
});

export const displayFont = { className: `${titillium.className} font-bold` };
