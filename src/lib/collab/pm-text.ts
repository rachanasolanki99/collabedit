interface PMNode {
  type?: string;
  text?: string;
  content?: PMNode[];
}

export function pmJsonToText(node: PMNode | null | undefined): string {
  if (!node) return "";
  if (node.text) return node.text;
  if (!node.content) return "";

  const blockTypes = new Set([
    "paragraph", "heading", "blockquote", "listItem", "codeBlock",
  ]);
  return node.content
    .map((child) => {
      const inner = pmJsonToText(child);
      return blockTypes.has(child.type ?? "") ? inner + "\n" : inner;
    })
    .join("");
}
