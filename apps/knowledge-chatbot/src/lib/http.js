import { timingSafeEqual } from "node:crypto";

const requestCounts = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readJson(request, maxBytes = 1_000_000) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw Object.assign(new Error("Request body exceeds the 1 MB limit."), { status: 413 });
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 });
  }
}

export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function rateLimit(request, limit = MAX_REQUESTS) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((value) => value.trim()).filter(Boolean);
  const ip = request.headers.get("x-real-ip")?.trim() || forwarded?.at(-1) || "unknown";
  const now = Date.now();
  if (requestCounts.size > 10_000) {
    for (const [key, item] of requestCounts) if (item.until <= now) requestCounts.delete(key);
    if (requestCounts.size > 20_000) requestCounts.clear();
  }
  const current = requestCounts.get(ip);
  if (!current || current.until <= now) {
    requestCounts.set(ip, { count: 1, until: now + WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export function guardRequest(request, { limit } = {}) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
  if (!rateLimit(request, limit)) {
    return json({ error: "Rate limit exceeded. Try again in one minute." }, 429);
  }
  return null;
}

export function apiError(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? "The request could not be completed. Check provider configuration and try again." : error.message;
  return json({ error: message, code: error?.code || "REQUEST_FAILED" }, status);
}

export function adminAuthorized(request) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
