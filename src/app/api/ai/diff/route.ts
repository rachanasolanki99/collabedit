import { NextRequest } from "next/server";
import { streamText } from "ai";
import { requireUser } from "@/lib/authz";
import { handle, json } from "@/lib/http";
import { aiDiffSchema } from "@/lib/validation";
import { aiConfigured, aiRateLimited, geminiModel, toSafeTextStream } from "@/lib/ai";

export const runtime = "nodejs";

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  if (!aiConfigured()) {
    return json({ error: "AI is not configured on the server." }, 503);
  }
  if (aiRateLimited(user.id)) {
    return json({ error: "Too many AI requests. Try again shortly." }, 429);
  }

  const { before, after } = aiDiffSchema.parse(await req.json());

  const result = streamText({
    model: geminiModel(),
    system:
      "You are a version-control assistant. Given two versions of a document, " +
      "explain what meaningfully changed as a short bulleted list (additions, " +
      "removals, reworded sections). Ignore trivial whitespace. Be specific but brief.",
    prompt: `--- PREVIOUS VERSION ---\n${before}\n\n--- CURRENT VERSION ---\n${after}`,
  });

  return toSafeTextStream(result);
});
