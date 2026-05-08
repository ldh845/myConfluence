"use client";

import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { useState } from "react";

// FR-031 — 코드 블록 React NodeView. 우상단에 언어 라벨 + 복사 버튼을
// 보여주고, ProseMirror가 관리하는 실제 코드는 NodeViewContent에 위임.
export default function CodeBlockNodeView({ node }: NodeViewProps) {
  const language = (node.attrs.language as string | null) || "plaintext";
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard 실패 시 사용자에게 굳이 모달까지 띄우진 않는다.
      setCopied(false);
    }
  };

  return (
    <NodeViewWrapper className="cf-code-block-wrapper relative group">
      <div
        className="absolute top-1.5 right-1.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        contentEditable={false}
      >
        <span className="text-[11px] uppercase tracking-wide text-[#6b778c] bg-white/85 border border-[#dfe1e6] rounded px-1.5 py-0.5">
          {language}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="text-[11px] text-[#42526e] bg-white/85 border border-[#dfe1e6] rounded px-2 py-0.5 hover:bg-[#ebecf0]"
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
