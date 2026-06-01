"use client";

import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { useState } from "react";
import { CODE_BLOCK_LANGUAGES } from "@/lib/tiptap/code-block-lowlight";

// FR-031 — 코드 블록 React NodeView.
// Cycle 83 followup 5 — 우상단 컨트롤:
//   · 언어 select (항상 보임, 변경 시 즉시 node attr 갱신)
//   · 복사 / '↓ 본문' (호버 시 노출) — 본문은 코드 블록 뒤에 빈 paragraph 삽입 후 포커스 이동.
export default function CodeBlockNodeView({
  node,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const language = (node.attrs.language as string | null) || "plaintext";
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  // 코드 블록 뒤에 빈 paragraph 를 삽입하고 그곳으로 커서 이동.
  const exitBlock = () => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (typeof pos !== "number") return;
    const after = pos + node.nodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(after, [{ type: "paragraph" }])
      .setTextSelection(after + 1)
      .run();
  };

  // CODE_BLOCK_LANGUAGES 에 없는 언어가 attrs 에 들어 있어도 표시되도록 옵션 추가.
  const options = CODE_BLOCK_LANGUAGES.includes(
    language as (typeof CODE_BLOCK_LANGUAGES)[number],
  )
    ? CODE_BLOCK_LANGUAGES
    : [language, ...CODE_BLOCK_LANGUAGES];

  return (
    <NodeViewWrapper className="cf-code-block-wrapper relative group">
      <div
        className="absolute top-1.5 right-1.5 flex items-center gap-1.5"
        contentEditable={false}
      >
        <select
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className="text-[11px] text-[#42526e] bg-white/85 border border-[#dfe1e6] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#0052cc]"
          title="언어 선택"
        >
          {options.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onCopy}
            className="text-[11px] text-[#42526e] bg-white/85 border border-[#dfe1e6] rounded px-2 py-0.5 hover:bg-[#ebecf0]"
          >
            {copied ? "복사됨" : "복사"}
          </button>
          <button
            type="button"
            onClick={exitBlock}
            title="코드 블록 빠져나가기 (본문으로)"
            className="text-[11px] text-[#42526e] bg-white/85 border border-[#dfe1e6] rounded px-2 py-0.5 hover:bg-[#ebecf0]"
          >
            ↓ 본문
          </button>
        </div>
      </div>
      <pre className="cf-code-block">
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
