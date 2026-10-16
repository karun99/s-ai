import { adminAuthorized, guardRequest, json, apiError } from "../../../../lib/http.js";
import { clearKnowledge } from "../../../../lib/kb.js";

export const dynamic = "force-dynamic";

export async function DELETE(request) {
  const blocked = guardRequest(request, { limit: 5 });
  if (blocked) return blocked;
  if (!adminAuthorized(request)) return json({ error: "Admin authorization required." }, 401);
  try {
    await clearKnowledge();
    return json({ cleared: true });
  } catch (error) { return apiError(error); }
}
