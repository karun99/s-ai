import { embed, validateVector } from "./embeddings.js";

const STORE_KEY = "s-ai:knowledge:v1";
const MAX_DOCS = 200;
const MAX_CHUNKS = 10_000;
const memory = { docs: [] };

function kvConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function loadState() {
  const config = kvConfig();
  if (!config) return { docs: memory.docs.slice() };
  const response = await fetch(config.url + "/get/" + encodeURIComponent(STORE_KEY), {
    headers: { Authorization: "Bearer " + config.token }, signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw Object.assign(new Error("Knowledge store is unavailable."), { status: 503, code: "STORE_UNAVAILABLE" });
  const result = await response.json();
  if (!result.result) return { docs: [] };
  try {
    const state = JSON.parse(result.result);
    return Array.isArray(state.docs) ? state : { docs: [] };
  } catch {
    throw Object.assign(new Error("Knowledge store contains invalid data."), { status: 503, code: "STORE_INVALID" });
  }
}

async function saveState(state) {
  const config = kvConfig();
  const json = JSON.stringify(state);
  if (new TextEncoder().encode(json).byteLength > 5_000_000) {
    throw Object.assign(new Error("Knowledge base exceeds the 5 MB storage limit."), { status: 413, code: "KB_SIZE_LIMIT" });
  }
  if (!config) {
    memory.docs = state.docs;
    return;
  }
  const response = await fetch(config.url, {
    method: "POST", headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json" },
    body: JSON.stringify(["SET", STORE_KEY, json]), signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw Object.assign(new Error("Knowledge store could not save data."), { status: 503, code: "STORE_UNAVAILABLE" });
}

export function chunkText(text, size = 800, overlap = 150) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const boundary = clean.lastIndexOf(" ", end);
      if (boundary > start + Math.floor(size * 0.6)) end = boundary;
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export function cosineSimilarity(a, b) {
  if (!validateVector(a) || !validateVector(b) || a.length !== b.length) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return -1;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function ingestDocument({ url, title, text, trust = "user-provided" }) {
  const pieces = chunkText(text);
  if (!pieces.length) throw new Error("Page contained no indexable text.");
  const chunks = [];
  for (const piece of pieces) {
    const result = await embed(piece);
    if (!validateVector(result.vector)) {
      throw Object.assign(new Error("Embedding provider returned an invalid vector."), { status: 502, code: "INVALID_EMBEDDING" });
    }
    chunks.push({ text: piece, vector: result.vector, provider: result.provider, model: result.model });
  }
  const state = await loadState();
  const doc = { url, title: title || url, trust, text: String(text).slice(0, 100_000), chunks, addedAt: new Date().toISOString() };
  state.docs = state.docs.filter((item) => item.url !== url);
  state.docs.push(doc);
  const count = state.docs.reduce((sum, item) => sum + item.chunks.length, 0);
  if (state.docs.length > MAX_DOCS || count > MAX_CHUNKS) {
    throw Object.assign(new Error("Knowledge base document or chunk limit reached."), { status: 413, code: "KB_LIMIT" });
  }
  await saveState(state);
  return { url, title: doc.title, chunks: chunks.length, trust };
}

export async function listDocuments() {
  const state = await loadState();
  return state.docs.map(({ url, title, chunks, addedAt, trust }) => ({ url, title, chunks: chunks.length, addedAt, trust }));
}

export async function clearKnowledge() {
  await saveState({ docs: [] });
}

export async function retrieve(query, topK = 5, threshold = 0.75) {
  const queryEmbedding = await embed(query);
  const state = await loadState();
  const matches = [];
  for (const doc of state.docs) {
    for (const chunk of doc.chunks) {
      if (chunk.provider !== queryEmbedding.provider || chunk.model !== queryEmbedding.model) continue;
      const score = cosineSimilarity(queryEmbedding.vector, chunk.vector);
      if (score >= threshold) matches.push({ text: chunk.text, url: doc.url, title: doc.title, trust: doc.trust, score });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, topK);
}

export function storageStatus() {
  return { persistent: Boolean(kvConfig()), kind: kvConfig() ? "upstash-rest" : "memory" };
}
