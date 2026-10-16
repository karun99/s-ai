const PROVIDERS = ["openrouter", "nvidia", "gemini", "azure"];

function configured(name) {
  if (name === "azure") return Boolean(process.env.AZURE_OPENAI_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT);
  if (name === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY);
  if (name === "nvidia") return Boolean(process.env.NVIDIA_API_KEY);
  if (name === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  return false;
}

export function providerStatus() {
  return {
    active: process.env.DEFAULT_PROVIDER || "auto",
    available: PROVIDERS.filter(configured),
    details: {
      openrouter: { configured: configured("openrouter"), model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free", free: true },
      nvidia: { configured: configured("nvidia"), model: process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct", free: true },
      gemini: { configured: configured("gemini"), model: process.env.GEMINI_MODEL || "gemini-1.5-flash", free: true },
      azure: { configured: configured("azure"), model: process.env.AZURE_OPENAI_DEPLOYMENT || null, free: false },
    },
  };
}

function modelFor(name) {
  if (name === "openrouter") return process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
  if (name === "nvidia") return process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";
  if (name === "gemini") return process.env.GEMINI_MODEL || "gemini-1.5-flash";
  return process.env.AZURE_OPENAI_DEPLOYMENT;
}

async function openAiCompatible(name, messages, options) {
  const model = modelFor(name);
  let url;
  let headers;
  if (name === "azure") {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "");
    url = endpoint + "/openai/deployments/" + encodeURIComponent(model) + "/chat/completions?api-version=" +
      encodeURIComponent(process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview");
    headers = { "api-key": process.env.AZURE_OPENAI_KEY };
  } else {
    const base = name === "nvidia"
      ? (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1")
      : (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1");
    url = base.replace(/\/+$/, "") + "/chat/completions";
    headers = { Authorization: "Bearer " + (name === "nvidia" ? process.env.NVIDIA_API_KEY : process.env.OPENROUTER_API_KEY) };
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ model, messages, temperature: options.temperature, max_tokens: options.maxTokens }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw Object.assign(new Error(name + " provider returned HTTP " + response.status + "."), { provider: name, retryable: response.status >= 500 || response.status === 429 });
  }
  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw Object.assign(new Error(name + " provider returned an empty response."), { provider: name, retryable: true });
  }
  return { content: content.trim(), provider: name, model, usage: body.usage };
}

async function gemini(messages, options) {
  const model = modelFor("gemini");
  const system = messages.filter((item) => item.role === "system").map((item) => item.content).join("\n\n");
  const contents = messages.filter((item) => item.role !== "system").map((item) => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.content }],
  }));
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model +
    ":generateContent?key=" + encodeURIComponent(process.env.GEMINI_API_KEY);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: options.temperature, maxOutputTokens: options.maxTokens },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw Object.assign(new Error("Gemini provider returned HTTP " + response.status + "."), { provider: "gemini", retryable: response.status >= 500 || response.status === 429 });
  }
  const body = await response.json();
  const content = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!content) throw Object.assign(new Error("Gemini provider returned an empty response."), { provider: "gemini", retryable: true });
  return { content, provider: "gemini", model, usage: body.usageMetadata };
}

function providerOrder(preferred) {
  if (preferred && preferred !== "auto") {
    if (!PROVIDERS.includes(preferred)) throw Object.assign(new Error("Unsupported provider."), { status: 400, code: "INVALID_PROVIDER" });
    return [preferred, ...PROVIDERS.filter((name) => name !== preferred)];
  }
  const freeOrder = ["openrouter", "nvidia", "gemini", "azure"];
  const paidOrder = ["azure", "gemini", "openrouter", "nvidia"];
  const primary = (process.env.PREFER_FREE || "true").toLowerCase() === "true" ? freeOrder : paidOrder;
  return [...primary.filter((name) => configured(name)), ...PROVIDERS.filter((name) => !primary.includes(name))];
}

export async function complete({ messages, preferredProvider = "auto", temperature = 0.3, maxTokens = 1024 }) {
  const available = providerOrder(preferredProvider).filter(configured);
  if (!available.length) {
    throw Object.assign(new Error("No language model provider is configured."), { status: 503, code: "NO_PROVIDER_CONFIGURED" });
  }
  const options = { temperature, maxTokens };
  let lastError;
  for (const name of available) {
    try {
      return name === "gemini"
        ? await gemini(messages, options)
        : await openAiCompatible(name, messages, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw Object.assign(new Error("All configured language model providers failed."), {
    status: 502, code: "ALL_PROVIDERS_FAILED", cause: lastError,
  });
}

export function isProviderConfigured(name) {
  return configured(name);
}
