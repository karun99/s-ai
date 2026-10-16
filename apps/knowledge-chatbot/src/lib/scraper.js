import * as cheerio from "cheerio";
import { fetchPublic } from "./ssrf.js";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;

export async function fetchPage(inputUrl) {
  const response = await fetchPublic(inputUrl, {
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
    headers: { "User-Agent": "S-AI-KnowledgeBot/0.1 (+https://github.com/karun99/s-ai)" },
  });
  if (!response.ok) throw new Error("Page returned HTTP " + response.status + ".");
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("text/html") && !type.includes("text/plain")) throw new Error("Only HTML and plain-text pages can be indexed.");
  const parsed = new URL(response.url);
  const html = new TextDecoder("utf-8", { fatal: false }).decode(response.body);
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim().slice(0, 300) || parsed.hostname;
  $("script, style, noscript, svg, nav, footer, header, iframe, form, aside").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 100_000);
  if (text.length < 200) throw new Error("Page did not contain enough readable text to index.");
  return { url: response.url, title, text };
}
