import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { inter, titillium } from "@/lib/fonts";
import { AppShell } from "@/components/app-shell";
import { RouteProgressHost } from "@/components/route-progress-host";
import { ThemeProvider } from "@/components/theme-provider";
import { isHosted } from "@/lib/hosted.mjs";
import { authEnabled } from "@/lib/auth.mjs";
import { ensureHostedFresh } from "@/lib/hosted-runtime";
import { readFollowupsEnabled } from "@/lib/followups-server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cafy Agent — your career assistant", template: "%s · Cafy Agent" },
  description: "Cafy Agent helps you discover roles, track applications and tailor your profile — privately.",
  // Home-screen / standalone (iOS): let our theme-color flow up to the status bar
  // + Dynamic Island; safe-area insets handle the layout.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Cafy Agent" },
};

export const viewport: Viewport = {
  // viewport-fit=cover → env(safe-area-inset-*) become non-zero so the header can
  // sit flush under the notch / Dynamic Island.
  viewportFit: "cover",
  // Default (corrected to the real theme before paint by THEME_SCRIPT, then kept
  // in sync by the theme toggle). Dark flows seamlessly into the black island.
  themeColor: "#0b0e16",
};

// Before paint: set the theme class AND tint the browser chrome (theme-color) to
// match — so Safari's status bar / URL bar unify with the header instead of a
// jarring light seam. Matches the header surface (light #ffffff / dark #0b0e16).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('career-ops:theme');var s=t==='light'||t==='dark'?t:null;var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content',d?'#0b0e16':'#ffffff');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  await ensureHostedFresh(); // hosted only: load the client's data before any page reads it
  const followupsEnabled = readFollowupsEnabled();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${titillium.variable}`}
    >
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <RouteProgressHost />
        <ThemeProvider>
          <AppShell followupsEnabled={followupsEnabled} hosted={isHosted()} signOut={isHosted() && authEnabled()}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
