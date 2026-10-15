import { apiError, adminAuthorized, guardRequest, json, readJson } from "../../../../lib/http.js";
import { ingestDocument } from "../../../../lib/kb.js";
import { fetchPage } from "../../../../lib/scraper.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const blocked = guardRequest(request, { limit: 5 });
  if (blocked) return blocked;
  if (!adminAuthorized(request)) return json({ error: "Admin authorization required." }, 401);
  try {
    const body = await readJson(request, 8_000);
    if (typeof body.url !== "string" || body.url.length > 2048) return json({ error: "Provide a valid public webpage URL." }, 400);
    const page = await fetchPage(body.url);
    const result = await ingestDocument({ ...page, trust: "user-provided" });
    return json(result, 201);
  } catch (error) { return apiError(error); }
}
