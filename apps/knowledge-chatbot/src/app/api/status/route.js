import { json } from "../../../lib/http.js";
import { listDocuments, storageStatus } from "../../../lib/kb.js";
import { providerStatus } from "../../../lib/llm.js";
import { embeddingProviderStatus } from "../../../lib/embeddings.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ providers: providerStatus(), embeddings: embeddingProviderStatus(), storage: storageStatus(), documents: await listDocuments() });
  } catch {
    return json({ error: "Status is temporarily unavailable." }, 503);
  }
}
