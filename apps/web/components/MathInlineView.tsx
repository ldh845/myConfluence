"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";

// FR-040 (Cycle 20) — 인라인 수식 NodeView.
// 평소엔 KaTeX HTML 렌더. 클릭하면 input으로 LaTeX 원문 편집. Enter/Esc/blur로 commit.
export default function MathInlineView({
  node,
  updateAttributes,
  deleteNode,
  editor,
}: NodeViewProps) {
  const latex = (node.attrs.latex as string) ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(latex);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);

  useEffect(() => {
    setDraft(latex);
  }, [latex]);

  const html = useMemo(() => {
    try {
      return katex.renderToString(latex || "\\,", {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      return "<span style=\"color:#de350b\">수식 오류</span>";
    }
  }, [latex]);

  const commit = () => {
    const next = draft.trim();
    if (!next) {
      deleteNode();
      return;
    }
    updateAttributes({ latex: next });
    setEditing(false);
  };

  const cancel = () => {
    setDraft(latex);
    setEditing(false);
  };

  return (
    <NodeViewWrapper
      as="span"
      className="math-inline-wrap"
      data-latex={latex}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="px-1 border border-[#0052cc] rounded text-[12px] font-mono bg-white"
          style={{ minWidth: 80 }}
        />
      ) : (
        <span
          onClick={() => {
            if (editor.isEditable) setEditing(true);
          }}
          className={
            editor.isEditable
              ? "cursor-pointer hover:bg-[#f4f8ff] rounded px-0.5"
              : ""
          }
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  );
}
