import * as cheerio from "cheerio";
import { assertPublicHttpUrl } from "./ssrf.js";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;

export async function fetchPage(inputUrl) {
  let url = inputUrl;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const parsed = await assertPublicHttpUrl(url);
    const response = await fetch(parsed.href, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "S-AI-KnowledgeBot/0.1 (+https://github.com/karun99/s-ai)" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === 3) throw new Error("Too many redirects.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect response did not include a location.");
      url = new URL(location, parsed).href;
      continue;
    }
    if (!response.ok) throw new Error("Page returned HTTP " + response.status + ".");
    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (!type.includes("text/html") && !type.includes("text/plain")) throw new Error("Only HTML and plain-text pages can be indexed.");
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) throw new Error("Page is larger than the 1.5 MB ingestion limit.");
    if (!response.body) throw new Error("Page did not include a readable body.");
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Page is larger than the 1.5 MB ingestion limit.");
      }
      chunks.push(value);
    }
    const buffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const $ = cheerio.load(html);
    const title = $("title").first().text().trim().slice(0, 300) || parsed.hostname;
    $("script, style, noscript, svg, nav, footer, header, iframe, form, aside").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 100_000);
    if (text.length < 200) throw new Error("Page did not contain enough readable text to index.");
    return { url: parsed.href, title, text };
  }
  throw new Error("Could not fetch page.");
}
