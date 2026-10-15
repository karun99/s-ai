function providerName() {
  return (process.env.EMBEDDING_PROVIDER || "gemini").toLowerCase();
}

export function embeddingProviderStatus() {
  const provider = providerName();
  const key = provider === "azure"
    ? process.env.AZURE_OPENAI_KEY && process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT
    : provider === "openrouter"
      ? process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_EMBEDDING_MODEL
      : provider === "nvidia"
        ? process.env.NVIDIA_API_KEY && process.env.NVIDIA_EMBEDDING_MODEL
        : provider === "gemini" ? process.env.GEMINI_API_KEY : false;
  return { provider, configured: Boolean(key) };
}

export async function embed(text) {
  const provider = providerName();
  const status = embeddingProviderStatus();
  if (!status.configured) {
    throw Object.assign(new Error("Configure the selected embedding provider before indexing or chatting."), {
      status: 503, code: "EMBEDDINGS_NOT_CONFIGURED",
    });
  }
  let result;
  if (provider === "gemini") {
    const model = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":embedContent?key=" + encodeURIComponent(process.env.GEMINI_API_KEY),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "models/" + model, content: { parts: [{ text }] } }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    result = await response.json();
    if (!response.ok) throw Object.assign(new Error("Embedding provider rejected the request."), { status: 502, code: "EMBEDDING_FAILED" });
    return { vector: result.embedding?.values, provider, model };
  }
  if (provider === "azure") {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, "");
    const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";
    const response = await fetch(endpoint + "/openai/deployments/" + encodeURIComponent(deployment) + "/embeddings?api-version=" + encodeURIComponent(apiVersion), {
      method: "POST", headers: { "Content-Type": "application/json", "api-key": process.env.AZURE_OPENAI_KEY },
      body: JSON.stringify({ input: text }), signal: AbortSignal.timeout(15_000),
    });
    result = await response.json();
  } else {
    const base = provider === "nvidia"
      ? (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1")
      : (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1");
    const model = provider === "nvidia" ? process.env.NVIDIA_EMBEDDING_MODEL : process.env.OPENROUTER_EMBEDDING_MODEL;
    const key = provider === "nvidia" ? process.env.NVIDIA_API_KEY : process.env.OPENROUTER_API_KEY;
    const response = await fetch(base.replace(/\/+$/, "") + "/embeddings", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ input: text, model }), signal: AbortSignal.timeout(15_000),
    });
    result = await response.json();
  }
  if (!result?.data?.[0]?.embedding) {
    throw Object.assign(new Error("Embedding provider returned an invalid response."), { status: 502, code: "EMBEDDING_FAILED" });
  }
  return { vector: result.data[0].embedding, provider, model: result.model || "configured" };
}

export function validateVector(value) {
  return Array.isArray(value) && value.length > 0 && value.length <= 4096 &&
    value.every((n) => Number.isFinite(n));
}
