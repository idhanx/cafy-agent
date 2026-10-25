import test from "node:test";
import assert from "node:assert/strict";
import { createSession, verifySession, checkPassword, safeNext, tooManyMisses, recordMiss, clearMisses, SESSION_TTL_S } from "../../src/lib/auth.mjs";
import { checkRequest } from "../../src/lib/origin-guard.mjs";
import { isHosted } from "../../src/lib/hosted.mjs";

const env = { CAFY_APP_PASSWORD: "correct horse", AUTH_SECRET: "s3cret" };

test("a session verifies, expires, and rejects tampering or another secret", () => {
  const t = createSession(env, 1_000_000_000_000);
  assert.ok(verifySession(t, env, 1_000_000_000_000 + 1000));
  assert.ok(!verifySession(t, env, 1_000_000_000_000 + (SESSION_TTL_S + 5) * 1000));
  assert.ok(!verifySession(t.replace(/.$/, "x"), env));
  assert.ok(!verifySession(t, { ...env, AUTH_SECRET: "other" }));
  assert.ok(!verifySession(t, {}), "no password configured → nothing verifies");
  assert.ok(!verifySession(undefined, env));
  assert.ok(!verifySession("a.b", env));
});

test("password check is exact and fails closed with no password configured", () => {
  assert.ok(checkPassword("correct horse", env));
  assert.ok(!checkPassword("correct horsE", env));
  assert.ok(!checkPassword("", env));
  assert.ok(!checkPassword("anything", {}));
  assert.ok(!checkPassword(undefined, env));
});

test("only same-site relative paths survive as a login destination", () => {
  assert.equal(safeNext("/pipeline?x=1"), "/pipeline?x=1");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "", null, undefined, "javascript:alert(1)"]) assert.equal(safeNext(bad), "/");
});

test("repeated wrong passwords are throttled, and success resets", () => {
  const k = "1.2.3.4";
  for (let i = 0; i < 8; i++) { assert.ok(!tooManyMisses(k)); recordMiss(k); }
  assert.ok(tooManyMisses(k));
  clearMisses(k);
  assert.ok(!tooManyMisses(k));
});

test("hosted guard admits the deployment's own host but still blocks cross-site requests", () => {
  const base = { origin: null, allowedHosts: new Set(), allowedOrigins: new Set() };
  assert.equal(checkRequest({ ...base, host: "app.vercel.app", secFetchSite: "same-origin" }).ok, false, "default guard is loopback-only");
  assert.equal(checkRequest({ ...base, host: "app.vercel.app", secFetchSite: "same-origin", trustHost: true }).ok, true);
  assert.equal(checkRequest({ ...base, host: "app.vercel.app", secFetchSite: "cross-site", trustHost: true }).ok, false);
  assert.equal(checkRequest({ ...base, host: "app.vercel.app", secFetchSite: null, origin: "https://evil.com", trustHost: true }).ok, false);
});

test("hosted mode is detected from Vercel and can be forced either way", () => {
  assert.ok(isHosted({ VERCEL: "1" }));
  assert.ok(isHosted({ CAFY_HOSTED: "1" }));
  assert.ok(!isHosted({}));
  assert.ok(!isHosted({ VERCEL: "1", CAFY_HOSTED: "0" }));
});

test("hosted: a page opened from another site is allowed, but cross-site requests that act are not", () => {
  const base = { origin: null, host: "app.vercel.app", secFetchSite: "cross-site", allowedHosts: new Set(), allowedOrigins: new Set(), trustHost: true };
  assert.equal(checkRequest({ ...base, allowCrossSiteNavigation: true }).ok, true);
  assert.equal(checkRequest({ ...base }).ok, false, "the proxy only sets the flag for GET page navigations");
  assert.equal(checkRequest({ ...base, secFetchSite: "same-site", allowCrossSiteNavigation: false }).ok, false);
});
