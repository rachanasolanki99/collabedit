import { z } from "zod";

export const LIMITS = {
  MAX_UPDATE_BYTES: 512 * 1024,
  MAX_SNAPSHOT_BYTES: 8 * 1024 * 1024,
  MAX_MESSAGES_PER_WINDOW: 240,
  RATE_WINDOW_MS: 10_000,
  MAX_TITLE_LEN: 200,
  MAX_LABEL_LEN: 120,
} as const;

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200, "Password is too long"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(200),
});

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.MAX_TITLE_LEN).optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.MAX_TITLE_LEN),
});

export const ROLE_VALUES = ["OWNER", "EDITOR", "VIEWER"] as const;

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(["EDITOR", "VIEWER"]),
});

export const updateMemberSchema = z.object({
  role: z.enum(ROLE_VALUES),
});

export const createVersionSchema = z.object({
  label: z.string().trim().min(1).max(LIMITS.MAX_LABEL_LEN),
  state: z
    .string()
    .min(1)
    .max(Math.ceil((LIMITS.MAX_SNAPSHOT_BYTES * 4) / 3) + 16),
});

export const aiSummarizeSchema = z.object({
  text: z.string().min(1).max(60_000),
});

export const aiDiffSchema = z.object({
  before: z.string().max(60_000),
  after: z.string().max(60_000),
});
