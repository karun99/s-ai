import dns from "node:dns/promises";
import net from "node:net";

function privateV4(ip) {
  const n = ip.split(".").map(Number);
  if (n.length !== 4 || n.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return n[0] === 0 || n[0] === 10 || n[0] === 127 || n[0] >= 224 ||
    (n[0] === 169 && n[1] === 254) || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) ||
    (n[0] === 192 && n[1] === 168) || (n[0] === 100 && n[1] >= 64 && n[1] <= 127) ||
    (n[0] === 198 && (n[1] === 18 || n[1] === 19));
}

function privateV6(ip) {
  const lower = ip.toLowerCase();
  // Only global-unicast space is eligible. This also blocks mapped IPv4,
  // loopback, link-local, ULA, multicast, and the special-purpose ranges.
  const first = Number.parseInt(lower.split(":")[0] || "0", 16);
  return !Number.isFinite(first) || first < 0x2000 || first > 0x3fff || lower.startsWith("2001:db8:");
}

export async function assertPublicHttpUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new Error("URL must be at most 2048 characters.");
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("Invalid URL."); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed.");
  if (parsed.username || parsed.password) throw new Error("URLs with embedded credentials are not allowed.");
  if (parsed.port && !["80", "443"].includes(parsed.port)) throw new Error("Only standard HTTP and HTTPS ports are allowed.");
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Local and private network URLs are not allowed.");
  }
  if (net.isIP(host)) {
    const privateAddress = net.isIPv4(host) ? privateV4(host) : privateV6(host);
    if (privateAddress) throw new Error("Local and private network URLs are not allowed.");
    return parsed;
  }
  let records;
  try { records = await dns.lookup(host, { all: true, verbatim: true }); }
  catch { throw new Error("URL host could not be resolved."); }
  if (!records.length || records.some((record) => net.isIPv4(record.address) ? privateV4(record.address) : privateV6(record.address))) {
    throw new Error("URL host resolves to a local or private network address.");
  }
  return parsed;
}
