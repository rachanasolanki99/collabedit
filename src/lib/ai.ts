import { google } from "@ai-sdk/google";

export const AI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

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
