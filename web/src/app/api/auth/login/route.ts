import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/json-body";
import { SESSION_COOKIE, SESSION_TTL_S, checkPassword, clearMisses, createSession, recordMiss, safeNext, tooManyMisses } from "@/lib/auth.mjs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJsonObject<{ password?: unknown; next?: unknown }>(req);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const who = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  if (tooManyMisses(who)) return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  if (!checkPassword(body.password)) {
    recordMiss(who);
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }
  clearMisses(who);
  const res = NextResponse.json({ ok: true, next: safeNext(body.next) });
  res.cookies.set(SESSION_COOKIE, createSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  return res;
}
