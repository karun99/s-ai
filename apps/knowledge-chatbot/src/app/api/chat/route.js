import { complete, providerStatus } from "../../../lib/llm.js";
import { retrieve } from "../../../lib/kb.js";
import { apiError, guardRequest, json, readJson } from "../../../lib/http.js";
import { reviewWithDuet, SAFE_FALLBACK } from "../../../lib/duet.js";
import { buildAnswerMessages, normalizeHistory } from "../../../lib/prompts.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const blocked = guardRequest(request, { limit: 12 });
  if (blocked) return blocked;
  try {
    const body = await readJson(request, 32_000);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Request body must be a JSON object." }, 400);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 4_000) return json({ error: "Enter a question up to 4,000 characters." }, 400);
    const history = normalizeHistory(body.history);
    const preferredProvider = typeof body.provider === "string" ? body.provider : (process.env.DEFAULT_PROVIDER || "auto");
    const sources = await retrieve(message, 5, 0.42);
    if (!sources.length) return json({ answer: SAFE_FALLBACK, sources: [], verified: false });
    const response = await complete({
      preferredProvider,
      maxTokens: 900,
      messages: buildAnswerMessages({ message, history, persona: process.env.ASSISTANT_PERSONA, sources }),
    });
    const reviewed = await reviewWithDuet({ answer: response.content, sources, complete, preferredProvider });
    return json({ answer: reviewed.answer, verified: reviewed.passed, sources: reviewed.passed ? sources.map(({ title, url, trust }) => ({ title, url, trust })) : [] });
  } catch (error) {
    if (error.status === 400) return apiError(error);
    if (error.status === 503) return apiError(error);
    if (!providerStatus().available.length) return json({ error: "No language model provider is configured." }, 503);
    return apiError(error);
  }
}
