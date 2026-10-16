import dns from "node:dns/promises";
import http from "node:http";
import net from "node:net";
import https from "node:https";

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;

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

export async function resolvePublicHttpUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new Error("URL must be at most 2048 characters.");
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("Invalid URL."); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed.");
  if (parsed.username || parsed.password) throw new Error("URLs with embedded credentials are not allowed.");
  const standardPort = parsed.protocol === "https:" ? "443" : "80";
  if (parsed.port && parsed.port !== standardPort) throw new Error("Only standard HTTP and HTTPS ports are allowed.");
  const host = parsed.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Local and private network URLs are not allowed.");
  }
  if (net.isIP(host)) {
    const privateAddress = net.isIPv4(host) ? privateV4(host) : privateV6(host);
    if (privateAddress) throw new Error("Local and private network URLs are not allowed.");
    return { url: parsed, addresses: [{ address: host, family: net.isIPv4(host) ? 4 : 6 }] };
  }
  let records;
  let lookupTimer;
  try {
    records = await Promise.race([
      dns.lookup(host, { all: true, verbatim: true }),
      new Promise((_, reject) => { lookupTimer = setTimeout(() => reject(new Error("DNS lookup timed out.")), 5_000); }),
    ]);
  }
  catch { throw new Error("URL host could not be resolved."); }
  finally { clearTimeout(lookupTimer); }
  if (!records.length || records.some((record) => net.isIPv4(record.address) ? privateV4(record.address) : privateV6(record.address))) {
    throw new Error("URL host resolves to a local or private network address.");
  }
  return { url: parsed, addresses: records };
}

export async function assertPublicHttpUrl(value) {
  return (await resolvePublicHttpUrl(value)).url;
}

function requestPinned(url, address, { headers = {}, timeoutMs = 8_000, maxBytes = 1_500_000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const options = {
      method: "GET",
      headers: { "Accept-Encoding": "identity", ...headers },
      lookup(_hostname, lookupOptions, callback) {
        if (lookupOptions.all) callback(null, [{ address: address.address, family: address.family }]);
        else callback(null, address.address, address.family);
      },
    };
    if (url.protocol === "https:" && !net.isIP(host)) options.servername = host;
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(url, options, (response) => {
      const status = response.statusCode || 0;
      const responseHeaders = Object.fromEntries(Object.entries(response.headers).map(([name, value]) => [
        name.toLowerCase(), Array.isArray(value) ? value.join(", ") : (value || ""),
      ]));
      const headersView = { get: (name) => responseHeaders[name.toLowerCase()] || null };
      if (REDIRECTS.has(status)) {
        response.destroy();
        finish(resolve, { status, headers: headersView, body: new Uint8Array() });
        return;
      }
      const chunks = [];
      let totalBytes = 0;
      response.on("data", (chunk) => {
        totalBytes += chunk.byteLength;
        if (totalBytes > maxBytes) {
          const error = new Error("Response is larger than the configured limit.");
          response.destroy();
          finish(reject, error);
          return;
        }
        chunks.push(chunk);
      });
      response.on("error", (error) => finish(reject, error));
      response.on("end", () => {
        const body = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        finish(resolve, { status, headers: headersView, body });
      });
    });
    request.on("error", (error) => finish(reject, error));
    timer = setTimeout(() => request.destroy(new Error("Request timed out.")), timeoutMs);
    request.end();
  });
}

export async function fetchPublic(value, options = {}) {
  let target = value;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const { url, addresses } = await resolvePublicHttpUrl(target);
    const address = addresses.find((item) => item.family === 4) || addresses[0];
    const response = await requestPinned(url, address, options);
    if (!REDIRECTS.has(response.status)) {
      return { ...response, url: url.href, ok: response.status >= 200 && response.status < 300 };
    }
    if (redirect === MAX_REDIRECTS) throw new Error("Too many redirects.");
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirect response did not include a location.");
    target = new URL(location, url).href;
  }
  throw new Error("Could not fetch page.");
}
