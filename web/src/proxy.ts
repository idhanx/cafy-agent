import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isHosted } from "@/lib/hosted.mjs";
import { SESSION_COOKIE, authEnabled, verifySession } from "@/lib/auth.mjs";
import {
  checkRequest,
  parseAllowedHosts,
  parseAllowedOrigins,
} from "@/lib/origin-guard.mjs";

// Single choke point over everything the dashboard serves. Every request is
// gated on the same-origin + loopback guard before it can reach a route handler
// (which may spawn a child process or write the user's files) or a page (which
// renders the user's CV, pipeline and reports). See origin-guard.mjs for the
// two-layer rationale (F1 drive-by CSRF, F2 LAN reachability).
//
// Opt in to extra hosts (e.g. a trusted LAN box) with a comma/space separated
// CAREER_OPS_WEB_ALLOWED_HOSTS; unset means loopback only.
//
// Opt in to extra *origins* the same way with CAREER_OPS_ALLOWED_ORIGINS;
// unset means none, which is the default and leaves the guard as strict as it
// was. It is what a local companion client needs: a browser extension calls
// from a chrome-extension:// origin, which Fetch Metadata always reports as
// "cross-site", so every one of its requests is refused otherwise.
// The sign-in screen and the brand images it shows must load before anyone has signed in.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/cafy-logo.svg", "/icon.svg"];

function hostedGate(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  // Sign-in is opt-in (CAFY_REQUIRE_SIGN_IN=1 plus a password); otherwise the site is open to whoever has the link.
  if (!authEnabled()) return null;
  if (PUBLIC_PATHS.includes(pathname)) return null;
  if (verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return null;
  if (isApi) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export function proxy(req: NextRequest) {
  const hosted = isHosted();
  const decision = checkRequest({
    trustHost: hosted,
    // Hosted only: opening a PAGE from another site (a link, the Vercel dashboard) must work.
    allowCrossSiteNavigation:
      hosted &&
      req.method === "GET" &&
      req.headers.get("sec-fetch-mode") === "navigate" &&
      req.headers.get("sec-fetch-dest") === "document" &&
      !req.nextUrl.pathname.startsWith("/api/"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    origin: req.headers.get("origin"),
    host: req.headers.get("host"),
    allowedHosts: parseAllowedHosts(process.env.CAREER_OPS_WEB_ALLOWED_HOSTS),
    allowedOrigins: parseAllowedOrigins(process.env.CAREER_OPS_ALLOWED_ORIGINS),
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.reason }, { status: decision.status });
  }
  if (hosted) return hostedGate(req) ?? NextResponse.next();
  return NextResponse.next();
}

// Everything except build assets. Scoping this to /api left every page route
// ungated, which loopback does not cover: a page that re-resolves its own domain
// to 127.0.0.1 (DNS rebinding) fetches /pipeline same-origin from the user's own
// browser, and force-dynamic pages read the tracker off disk on each request.
// The Host header carries the attacker's domain there, so the guard refuses it —
// but only if it runs. Build assets stay out: they are the same for every user,
// carry nothing of theirs, and a caller who cannot read a page has no use for
// the chunk that renders it.
export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
