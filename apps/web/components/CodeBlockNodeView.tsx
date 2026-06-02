"use client";

import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { useState } from "react";
import { CODE_BLOCK_LANGUAGES } from "@/lib/tiptap/code-block-lowlight";

// FR-031 — 코드 블록 React NodeView.
// Cycle 84 — 우상단 컨트롤:
//   · 언어 select (항상 보임, 변경 시 즉시 node attr 갱신)
//   · 복사 (호버 시 노출)
//   탈출은 키보드(끝에서 ArrowRight / Mod-Enter / 트리플 Enter) — extension 단에서 처리.
export default function CodeBlockNodeView({
  node,
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
        <button
          type="button"
          onClick={onCopy}
          className="text-[11px] text-[#42526e] bg-white/85 border border-[#dfe1e6] rounded px-2 py-0.5 hover:bg-[#ebecf0] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <pre className="cf-code-block">
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
