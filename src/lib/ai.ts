import { google } from "@ai-sdk/google";

export const AI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

type AiStreamPart = { type: "text-delta"; text: string } | { type: "error"; error: unknown } | { type: string };

/**
 * `streamText(...).toTextStreamResponse()` sends a 200 and starts streaming
 * immediately; if the model call then fails mid-stream (rate limit, quota,
 * network), the AI SDK has no way to change the already-sent status code.
 * Worse, `result.textStream` just ends quietly on failure instead of
 * throwing — it silently drops the SDK's own `{ type: "error" }` part — so
 * by default the client sees an empty stream with no error at all. Reading
 * `fullStream` instead lets us see that error part and turn it into visible
 * text.
 */
export function toSafeTextStream(result: { fullStream: AsyncIterable<AiStreamPart> }): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            controller.enqueue(encoder.encode((part as { text: string }).text));
          } else if (part.type === "error") {
            const err = (part as { error: unknown }).error;
            console.error("[ai] stream failed:", err);
            const message = err instanceof Error ? err.message : "AI request failed.";
            controller.enqueue(encoder.encode(`\n\n[AI error] ${message}`));
          }
        }
      } catch (err) {
        console.error("[ai] stream failed:", err);
        const message = err instanceof Error ? err.message : "AI request failed.";
        controller.enqueue(encoder.encode(`\n\n[AI error] ${message}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

export function geminiModel() {
  return google(AI_MODEL);
}

const hits = new Map<string, number[]>();
const MAX_PER_MINUTE = 8;

export function aiRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > MAX_PER_MINUTE;
}
