// FR-121 (Cycle 21) — Markdown 다운로드.
// 페이지 content + 다이어그램 preview SVG + 첨부 링크를 한 파일로 묶어 .md 저장.

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

export async function downloadPageMarkdown(page: ExportPage): Promise<void> {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  // 다이어그램 · 첨부 fetch (실패해도 본문은 내보냄).
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

  const parts: string[] = [];
  parts.push(`# ${page.title}\n`);
  parts.push(page.content);

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
  // 다음 프레임에 revoke (download 트리거 후)
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
