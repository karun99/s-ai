import { assertPublicHttpUrl } from "./ssrf.js";
import * as cheerio from "cheerio";

export async function searchWeb(query, limit = 5) {
  const endpoint = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  const response = await fetch(await assertPublicHttpUrl(endpoint), {
    signal: AbortSignal.timeout(8_000),
    headers: { "User-Agent": "S-AI-KnowledgeBot/0.1" },
  });
  if (!response.ok) throw new Error("Web search returned HTTP " + response.status + ".");
  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];
  $(".result").each((_, element) => {
    if (results.length >= limit) return;
    const anchor = $(element).find(".result__a").first();
    const title = anchor.text().trim();
    const raw = anchor.attr("href");
    const snippet = $(element).find(".result__snippet").text().trim();
    if (!raw || !title) return;
    let url;
    try {
      const parsed = new URL(raw, "https://duckduckgo.com");
      const target = parsed.searchParams.get("uddg");
      url = target ? decodeURIComponent(target) : parsed.href;
    } catch { return; }
    if (!/^https?:\/\//i.test(url)) return;
    results.push({ url, title, snippet });
  });
  return results;
}
