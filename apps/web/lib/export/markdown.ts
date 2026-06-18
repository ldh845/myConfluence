// Markdown 다운로드.
// 렌더링된 에디터 HTML → turndown 변환 → .md 저장.
// ProseMirror JSON을 직렬화하지 않고 브라우저에 이미 렌더링된
// 콘텐츠를 사용하므로 커스텀 노드(다이어그램·수식·테이블 등)도 정확하게 변환됨.

import TurndownService from "turndown";

type ExportPage = {
  id: string;
  title: string;
  content: string;
};

type Diagram = {
  id: string;
  title: string;
  preview: string | null;
};

type Attachment = {
  id: string;
  filename: string;
  size: number;
  mimetype: string;
};

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "page";
}

function utf8ToBase64(text: string): string {
  if (typeof window === "undefined") return "";
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 에디터 DOM에서 렌더링된 HTML 추출 */
function getRenderedHTML(): string {
  // 조회 모드: .ProseMirror 요소에서 직접 가져오기
  const pm = document.querySelector(".ProseMirror");
  if (pm) return pm.innerHTML;

  // 편집 모드: FullScreenEditor 내부
  const editor = document.querySelector("[data-testid='fullscreen-editor'] .ProseMirror");
  if (editor) return editor.innerHTML;

  return "";
}

/** turndown 인스턴스 생성 — 커스텀 노드 규칙 포함 */
function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // figure > img + figcaption → ![alt](src) *caption*
  td.addRule("figure", {
    filter: "figure",
    replacement(_content: string, node: HTMLElement) {
      const el = node as HTMLElement;
      const img = el.querySelector("img");
      const caption = el.querySelector("figcaption");
      if (!img) return "";
      const src = img.getAttribute("src") || "";
      const alt = img.getAttribute("alt") || "";
      const cap = caption?.textContent?.trim();
      const md = `![${alt}](${src})`;
      return cap ? `${md}\n*${cap}*\n` : `${md}\n`;
    },
  });

  // 체크리스트 — li[data-type="taskItem"]
  td.addRule("taskItem", {
    filter: (node: HTMLElement) =>
      node.nodeName === "LI" &&
      node.getAttribute("data-type") === "taskItem",
    replacement(_content: string, node: HTMLElement) {
      const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
      const text = (_content || "").trim();
      return `- [${checked ? "x" : " "}] ${text}\n`;
    },
  });

  // 상태 배지 — span[data-type="statusBadge"]
  td.addRule("statusBadge", {
    filter: (node: HTMLElement) =>
      node.nodeName === "SPAN" &&
      node.getAttribute("data-type") === "statusBadge",
    replacement(_content: string, node: HTMLElement) {
      const text = (node as HTMLElement).textContent?.trim() || "";
      return `[${text}]`;
    },
  });

  // 정보 패널 — div[data-type="infoPanel"]
  td.addRule("infoPanel", {
    filter: (node: HTMLElement) =>
      node.nodeName === "DIV" &&
      node.getAttribute("data-type") === "infoPanel",
    replacement(content: string, node: HTMLElement) {
      const title = (node as HTMLElement).getAttribute("data-title") || "";
      const body = content.trim();
      return title
        ? `> **${title}**\n> ${body}\n`
        : `> ${body}\n`;
    },
  });

  // 다이어그램 — div[data-type="diagram"]
  td.addRule("diagram", {
    filter: (node: HTMLElement) =>
      node.nodeName === "DIV" &&
      node.getAttribute("data-type") === "diagram",
    replacement(_content: string, node: HTMLElement) {
      const el = node as HTMLElement;
      const title = el.getAttribute("data-title") || "다이어그램";
      const img = el.querySelector("img");
      if (img) {
        const src = img.getAttribute("src") || "";
        return `![${title}](${src})\n`;
      }
      return `*[${title} — 다이어그램 미리보기 없음]*\n`;
    },
  });

  // 수식 인라인 — span[data-type="mathInline"]
  td.addRule("mathInline", {
    filter: (node: HTMLElement) =>
      node.nodeName === "SPAN" &&
      node.getAttribute("data-type") === "mathInline",
    replacement(_content: string, node: HTMLElement) {
      const latex = (node as HTMLElement).getAttribute("data-latex") || "";
      return `$${latex}$`;
    },
  });

  // 수식 블록 — div[data-type="mathBlock"]
  td.addRule("mathBlock", {
    filter: (node: HTMLElement) =>
      node.nodeName === "DIV" &&
      node.getAttribute("data-type") === "mathBlock",
    replacement(_content: string, node: HTMLElement) {
      const latex = (node as HTMLElement).getAttribute("data-latex") || "";
      return `\n$$\n${latex}\n$$\n`;
    },
  });

  // 날짜 — span[data-type="date"]
  td.addRule("date", {
    filter: (node: HTMLElement) =>
      node.nodeName === "SPAN" &&
      node.getAttribute("data-type") === "date",
    replacement(_content: string, node: HTMLElement) {
      const date = (node as HTMLElement).getAttribute("data-date") || "";
      return `{date:${date}}`;
    },
  });

  // 멘션 — span[data-type="mention"]
  td.addRule("mention", {
    filter: (node: HTMLElement) =>
      node.nodeName === "SPAN" &&
      node.getAttribute("data-type") === "mention",
    replacement(_content: string, node: HTMLElement) {
      const name = (node as HTMLElement).textContent?.trim() || "";
      return `@${name}`;
    },
  });

  return td;
}

export async function downloadPageMarkdown(page: ExportPage): Promise<void> {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  // 1) 렌더링된 HTML에서 Markdown 변환
  const html = getRenderedHTML();
  let bodyMd = "";

  if (html) {
    // 렌더링된 HTML이 있으면 turndown으로 변환
    const td = createTurndown();
    bodyMd = td.turndown(html);
  } else {
    // 폴백: content가 이미 Markdown이면 그대로, JSON이면 원시 텍스트로
    const trimmed = (page.content || "").trimStart();
    if (trimmed.startsWith("{")) {
      // ProseMirror JSON — 렌더링 불가하므로 간단한 텍스트 추출
      try {
        const json = JSON.parse(page.content);
        bodyMd = extractTextFromProseMirror(json);
      } catch {
        bodyMd = page.content;
      }
    } else {
      bodyMd = page.content;
    }
  }

  // 2) 다이어그램 · 첨부 fetch (실패해도 본문은 내보냄).
  let diagrams: Diagram[] = [];
  let attachments: Attachment[] = [];
  try {
    const r = await fetch(`/api/pages/${page.id}/diagrams`);
    if (r.ok) diagrams = (await r.json()) as Diagram[];
  } catch {
    // ignore
  }
  try {
    const r = await fetch(`/api/pages/${page.id}/attachments`);
    if (r.ok) attachments = (await r.json()) as Attachment[];
  } catch {
    // ignore
  }

  // 3) 최종 Markdown 조합
  const parts: string[] = [];
  parts.push(`# ${page.title}\n`);
  parts.push(bodyMd);

  if (diagrams.length > 0) {
    parts.push("\n\n## 📐 다이어그램\n");
    for (const d of diagrams) {
      parts.push(`### ${d.title}\n`);
      if (d.preview) {
        const dataUri = `data:image/svg+xml;base64,${utf8ToBase64(d.preview)}`;
        parts.push(`![${d.title}](${dataUri})\n`);
      } else {
        parts.push(`(미리보기 없음)\n`);
      }
    }
  }

  if (attachments.length > 0) {
    parts.push("\n\n## 📎 첨부파일\n");
    for (const a of attachments) {
      const url = `${origin}/api/attachments/${a.id}`;
      parts.push(
        `- [${a.filename}](${url}) — ${a.mimetype}, ${formatSize(a.size)}\n`,
      );
    }
  }

  const md = parts.join("\n");
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(page.title)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** ProseMirror JSON에서 텍스트만 간단 추출 (폴백용) */
function extractTextFromProseMirror(json: Record<string, unknown>): string {
  const lines: string[] = [];

  function walk(node: Record<string, unknown>, depth: number) {
    const type = node.type as string;

    if (type === "text") {
      lines.push((node.text as string) || "");
      return;
    }

    if (type === "heading") {
      const level = (node.attrs as Record<string, unknown>)?.level ?? 1;
      const prefix = "#".repeat(level as number) + " ";
      const children = (node.content as { content?: unknown[] })?.content;
      if (children) {
        const text = collectText(children as Record<string, unknown>[]);
        lines.push(prefix + text);
      }
      return;
    }

    if (type === "paragraph") {
      const children = (node.content as { content?: unknown[] })?.content;
      if (children) {
        lines.push(collectText(children as Record<string, unknown>[]));
      } else {
        lines.push("");
      }
      return;
    }

    if (type === "bulletList" || type === "orderedList") {
      const children = (node.content as { content?: unknown[] })?.content;
      if (children) {
        for (const child of children) {
          walk(child as Record<string, unknown>, depth + 1);
        }
      }
      return;
    }

    if (type === "listItem" || type === "taskItem") {
      const prefix = type === "taskItem"
        ? `- [${(node.attrs as Record<string, unknown>)?.checked ? "x" : " "}] `
        : "- ";
      const children = (node.content as { content?: unknown[] })?.content;
      if (children) {
        const text = collectText(children as Record<string, unknown>[]);
        lines.push(prefix + text);
      }
      return;
    }

    if (type === "codeBlock") {
      const lang = (node.attrs as Record<string, unknown>)?.language || "";
      const children = (node.content as { content?: unknown[] })?.content;
      const text = children
        ? collectText(children as Record<string, unknown>[])
        : "";
      lines.push(`\`\`\`${lang}\n${text}\n\`\`\``);
      return;
    }

    if (type === "blockquote") {
      const children = (node.content as { content?: unknown[] })?.content;
      if (children) {
        for (const child of children) {
          const old = lines.length;
          walk(child as Record<string, unknown>, depth + 1);
          // 앞에 > 붙이기
          for (let i = old; i < lines.length; i++) {
            lines[i] = "> " + lines[i];
          }
        }
      }
      return;
    }

    // 기타 노드: 자식 순회
    const children = (node.content as { content?: unknown[] })?.content;
    if (children) {
      for (const child of children) {
        walk(child as Record<string, unknown>, depth + 1);
      }
    }
  }

  function collectText(nodes: Record<string, unknown>[]): string {
    return nodes.map((n) => {
      if (n.type === "text") return (n.text as string) || "";
      if (n.content) return collectText((n.content as { content: unknown[] }).content as Record<string, unknown>[]);
      return "";
    }).join("");
  }

  const content = (json.content as { content?: unknown[] })?.content;
  if (content) {
    for (const child of content) {
      walk(child as Record<string, unknown>, 0);
    }
  }

  return lines.join("\n\n");
}