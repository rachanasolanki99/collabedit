import { NextRequest } from "next/server";
import { streamText } from "ai";
import { requireUser } from "@/lib/authz";
import { handle, json } from "@/lib/http";
import { aiSummarizeSchema } from "@/lib/validation";
import { aiConfigured, aiRateLimited, geminiModel } from "@/lib/ai";

export const runtime = "nodejs";

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  if (!aiConfigured()) {
    return json({ error: "AI is not configured on the server." }, 503);
  }
  if (aiRateLimited(user.id)) {
    return json({ error: "Too many AI requests. Try again shortly." }, 429);
  }

  const { text } = aiSummarizeSchema.parse(await req.json());

  const result = streamText({
    model: geminiModel(),
    system:
      "You are a concise writing assistant. Summarize the document in 3-5 bullet points, " +
      "capturing the key ideas and any action items. Use plain language.",
    prompt: text,
  });

  return result.toTextStreamResponse();
});
