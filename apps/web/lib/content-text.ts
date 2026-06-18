type JsonObject = Record<string, unknown>;

const blockNodeTypes = new Set([
  "doc",
  "paragraph",
  "heading",
  "orderedList",
  "bulletList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
  "callout",
]);
const maxLineLength = 180;


export function contentToPreview(content: unknown): string {
  const line = contentToReadableLines(content)[0];
  if (!line) return "본문이 없습니다.";
  if (line.length <= maxLineLength) return line;

  const start = line.slice(0, 140);
  const end = line.slice(line.length - 32);
  return `${start}…${end}`;
}

export function contentToReadableLines(content: unknown): string[] {
  const text = contentToReadableText(content);
  return normalizeTextLines(text);
}

export function contentToReadableText(content: unknown): string {
  const json = canParseJson(content) ? parseJsonContent(content) : null;

  if (json !== null) {
    const serialized = serializeJsonContent(json, true).trimEnd();
    if (serialized) return serialized;
    return collectTiptapStrings(json).join("\n").trim();
  }

  if (typeof content === "string" && content.trim().startsWith("|")) return content.trim();
  if (typeof content === "string") return content;
  return "";
}

export function contentTiptapStringFallback(content: unknown): string[] {
  if (!canParseJson(content)) return [];
  const json = parseJsonContent(content);
  if (!json) return [];

  const serialized = serializeJsonContent(json, true).trimEnd();
  if (serialized) return [];
  return normalizeTextLines(collectTiptapStrings(json).join("\n"));
}

function normalizeTextLines(text: string): string[] {
  const lines: string[] = [];
  if (!text.trim()) return lines;

  const normalized = text
    .trim()
    .replaceAll("\r", "")
    .replaceAll(/[ \t]{2,}/g, " ")
    .replaceAll(/\n{3,}/g, "\n\n");

  for (const softLine of normalized.split("\n")) {
    const trimmed = softLine.trim();
    if (!trimmed) continue;

    const parts = trimStartOnly(trimmed.match(/[\S]+/g) ?? []);
    let current = "";

    for (const part of parts) {
      const next = current ? `${current} ${part}` : part;
      if (next.length > maxLineLength && current) {
        lines.push(current);
        current = part;
      } else {
        current = next;
      }
    }

    if (current) lines.push(current.trimEnd());
  }

  return lines.filter(Boolean);
}

function serializeJsonContent(node: JsonObject | undefined, asDocument: boolean): string {
  if (!node) return "";

  const type = String(node.type ?? "");
  if (type === "text") return String(node.text ?? "");
  if (type === "hardBreak" || type === "hardbreak") return "\n";

  if (type === "image") {
    const values = [
      node.alt,
      node.src,
      String(nodeAttrs(node).src ?? ""),
      String(nodeAttrs(node).src ?? ""),
      node.caption,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ");
    return values.trim();
  }

  if (type === "codeBlock") {
    const attrs = nodeAttrs(node);
    const language = String(attrs.language ?? "");
    const code = typeof attrs.content === "string" ? attrs.content : "";
    return [language, code].filter(Boolean).join("\n");
  }

  if (type === "horizontalRule") {
    return "——\n";
  }

  if (type === "table") {
    return tableRowsToText(node).trimEnd() + "\n";
  }

  const childParts = contentChildren(node)
    .map((child) => `${serializeJsonContent(child, false)}${childNeedsBlockBreak(child) ? "" : " "}`)
    .join("");

  const normalized = childParts.trim();
  return childNeedsBlockBreak(node) ? `${normalized}\n` : normalized;
}

function collectTiptapStrings(root: JsonObject): string[] {
  const values: string[] = [];

  function visit(node: unknown, key = ""): void {
    if (typeof node === "string") {
      if (["type", "marks", "year", "month", "day", "title", "authorName", "note"].includes(key)) return;
      values.push(node);
      return;
    }

    if (!isObject(node)) return;

    if (Array.isArray(node.content)) {
      node.content.forEach((child) => visit(child));
      return;
    }

    for (const [childKey, childValue] of Object.entries(node)) {
      if (["type", "marks", "id", "year", "month", "day", "from", "to"].includes(childKey)) continue;
      visit(childValue, childKey);
    }
  }

  visit(root);
  return values;
}

function tableRowsToText(node: JsonObject): string {
  const rows = tableRows(node);
  if (!rows.length) return "";

  const rowTexts = rows.map((row) => {
    const cellText = (row as unknown as JsonObject[])
      .map((cell) => serializeJsonContent(cell, false).trim())
      .filter(Boolean);
    return cellText.join(" | ");
  });

  return rowTexts.join("\n");
}

function tableRows(node: JsonObject): JsonObject[] {
  const attrs = nodeAttrs(node);
  const rows = Object.values(attrs)
    .flat()
    .filter((value): value is JsonObject => isObject(value));

  if (rows.length) return rows;

  return contentChildren(node)
    .map((child) => contentChildren(child))
    .flat()
    .filter((value): value is JsonObject => isObject(value))
    .filter((row) => !blockNodeTypes.has(String(row.type ?? "")));
}

function contentChildren(node: JsonObject): JsonObject[] {
  const rawContent = attrs(node).content;
  return Array.isArray(rawContent) ? rawContent.filter(isObject) : [];
}

function childNeedsBlockBreak(node: JsonObject): boolean {
  const type = String(node.type ?? "");
  return type === "hardBreak" || type === "hardbreak" || blockNodeTypes.has(type);
}

function nodeAttrs(node: JsonObject): JsonObject {
  return isObject(node.attrs) ? node.attrs : {};
}

function attrs(target: JsonObject): JsonObject {
  if (!target.attrs) return {};
  if (typeof target.attrs === "string") return { content: target.attrs };
  if (!isObject(target.attrs)) return {};
  return target.attrs;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimStartOnly(values: string[]): string[] {
  return values.map((value) => value.replace(/^[\s]+/, ""));
}

function parseJsonContent(value: string): JsonObject | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function canParseJson(value: unknown): value is string {
  return typeof value === "string" && value.trimStart().startsWith("{") && value.trimEnd().endsWith("}");
}