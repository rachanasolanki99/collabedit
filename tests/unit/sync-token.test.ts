import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.SYNC_JWT_SECRET = "test-secret-for-sync-tokens-0123456789";
});

describe("sync room tokens", () => {
  it("round-trips a valid token and preserves the role", async () => {
    const { issueSyncToken, verifySyncToken } = await import("@/lib/sync-token");
    const token = issueSyncToken({ sub: "user1", doc: "doc1", role: "EDITOR" });
    const payload = verifySyncToken(token);
    expect(payload.sub).toBe("user1");
    expect(payload.doc).toBe("doc1");
    expect(payload.role).toBe("EDITOR");
  });

  it("rejects a tampered / forged token", async () => {
    const { verifySyncToken } = await import("@/lib/sync-token");
    expect(() => verifySyncToken("not.a.real.token")).toThrow();
  });

  it("rejects a token signed with a different secret", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const forged = jwt.sign({ sub: "x", doc: "d", role: "OWNER" }, "wrong-secret");
    const { verifySyncToken } = await import("@/lib/sync-token");
    expect(() => verifySyncToken(forged)).toThrow();
  });
});
