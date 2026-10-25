// url-guard.mjs — SSRF guard for the agent's web_fetch tool. A posting URL is
// untrusted input, and on a hosted deployment the server can reach things the
// visitor cannot (cloud metadata, internal services), so private, loopback and
// link-local targets are refused — by literal address AND after DNS resolution.
import dns from "node:dns/promises";
import net from "node:net";

function privateV4(ip) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return privateV4(ip);
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::" || l === "::1") return true;
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return privateV4(mapped[1]);
    return l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe8") || l.startsWith("fe9") || l.startsWith("fea") || l.startsWith("feb");
  }
  return true;
}

/** Throws a readable Error when `raw` must not be fetched. Returns the URL. */
export async function assertPublicUrl(raw, lookup = (h) => dns.lookup(h, { all: true })) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("not a valid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("only http(s) URLs can be fetched");
  if (u.username || u.password) throw new Error("URLs with credentials are not fetched");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error("that host is not public");
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("that address is not public");
    return u;
  }
  const addrs = await lookup(host);
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("that host does not resolve to a public address");
  return u;
}
