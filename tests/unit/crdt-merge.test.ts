import { describe, it, expect } from "vitest";
import * as Y from "yjs";

function text(doc: Y.Doc): string {
  return doc.getText("t").toString();
}

describe("CRDT deterministic merge", () => {
  it("converges to the SAME state regardless of merge order", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();

    a.getText("t").insert(0, "Hello world");
    const base = Y.encodeStateAsUpdate(a);
    Y.applyUpdate(b, base);

    a.getText("t").insert(5, " brave");
    b.getText("t").insert(11, "!");

    const ua = Y.encodeStateAsUpdate(a);
    const ub = Y.encodeStateAsUpdate(b);

    const m1 = new Y.Doc();
    Y.applyUpdate(m1, ua);
    Y.applyUpdate(m1, ub);

    const m2 = new Y.Doc();
    Y.applyUpdate(m2, ub);
    Y.applyUpdate(m2, ua);

    expect(text(m1)).toBe(text(m2));
    expect(text(m1)).toContain("brave");
    expect(text(m1)).toContain("!");
  });

  it("reconciles offline edits on reconnect without overwriting remote work", () => {
    const server = new Y.Doc();
    const client = new Y.Doc();

    server.getText("t").insert(0, "shared base. ");
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server));

    client.getText("t").insert(client.getText("t").length, "[offline edit] ");

    server.getText("t").insert(server.getText("t").length, "[remote edit] ");

    const clientSV = Y.encodeStateVector(client);
    const serverSV = Y.encodeStateVector(server);
    const serverDiff = Y.encodeStateAsUpdate(server, clientSV);
    const clientDiff = Y.encodeStateAsUpdate(client, serverSV);

    Y.applyUpdate(client, serverDiff);
    Y.applyUpdate(server, clientDiff);

    expect(text(client)).toBe(text(server));
    expect(text(server)).toContain("[offline edit]");
    expect(text(server)).toContain("[remote edit]");
  });

  it("merges via mergeUpdates equivalently to sequential application (server compaction)", () => {
    const doc = new Y.Doc();
    const updates: Uint8Array[] = [];
    doc.on("update", (u) => updates.push(u));

    doc.getText("t").insert(0, "one ");
    doc.getText("t").insert(4, "two ");
    doc.getText("t").insert(8, "three");

    const merged = Y.mergeUpdates(updates);
    const rebuilt = new Y.Doc();
    Y.applyUpdate(rebuilt, merged);

    expect(text(rebuilt)).toBe("one two three");
  });
});
