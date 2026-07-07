import { describe, it, expect } from "vitest";
import {
  registerSchema, createVersionSchema, addMemberSchema, LIMITS,
} from "@/lib/validation";

describe("input validation (defence against bad/oversized payloads)", () => {
  it("accepts a valid registration and normalizes email", () => {
    const parsed = registerSchema.parse({
      name: "Ada",
      email: "ADA@Example.com ",
      password: "supersecret",
    });
    expect(parsed.email).toBe("ada@example.com");
  });

  it("rejects short passwords", () => {
    expect(() =>
      registerSchema.parse({ name: "Ada", email: "a@b.com", password: "short" }),
    ).toThrow();
  });

  it("rejects a snapshot payload larger than the cap (anti-OOM)", () => {
    const tooBig = "A".repeat(Math.ceil((LIMITS.MAX_SNAPSHOT_BYTES * 4) / 3) + 1000);
    expect(() => createVersionSchema.parse({ label: "v", state: tooBig })).toThrow();
  });

  it("does not allow inviting someone directly as OWNER", () => {
    expect(() =>
      addMemberSchema.parse({ email: "a@b.com", role: "OWNER" }),
    ).toThrow();
    expect(addMemberSchema.parse({ email: "a@b.com", role: "EDITOR" }).role).toBe("EDITOR");
  });
});
