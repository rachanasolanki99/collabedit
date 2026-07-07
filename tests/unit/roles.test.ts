import { describe, it, expect } from "vitest";
import { roleAtLeast, canWrite, ROLE_RANK } from "@/lib/roles";

describe("role hierarchy", () => {
  it("ranks OWNER > EDITOR > VIEWER", () => {
    expect(ROLE_RANK.OWNER).toBeGreaterThan(ROLE_RANK.EDITOR);
    expect(ROLE_RANK.EDITOR).toBeGreaterThan(ROLE_RANK.VIEWER);
  });

  it("roleAtLeast respects the hierarchy", () => {
    expect(roleAtLeast("OWNER", "VIEWER")).toBe(true);
    expect(roleAtLeast("OWNER", "OWNER")).toBe(true);
    expect(roleAtLeast("EDITOR", "OWNER")).toBe(false);
    expect(roleAtLeast("VIEWER", "EDITOR")).toBe(false);
  });

  it("only OWNER and EDITOR can write (viewers are read-only)", () => {
    expect(canWrite("OWNER")).toBe(true);
    expect(canWrite("EDITOR")).toBe(true);
    expect(canWrite("VIEWER")).toBe(false);
  });
});
