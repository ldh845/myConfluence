"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";

// FR-040 (Cycle 20) — 블록 수식 NodeView. textarea + displayMode KaTeX.
export default function MathBlockView({
  node,
  updateAttributes,
  deleteNode,
  editor,
}: NodeViewProps) {
  const latex = (node.attrs.latex as string) ?? "";
  const [editing, setEditing] = useState(latex === "");
  const [draft, setDraft] = useState(latex);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) requestAnimationFrame(() => taRef.current?.focus());
  }, [editing]);

  useEffect(() => {
    setDraft(latex);
  }, [latex]);

  const html = useMemo(() => {
    try {
      return katex.renderToString(latex || "\\,", {
        throwOnError: false,
        displayMode: true,
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
    if (!latex) deleteNode();
    else setEditing(false);
  };

  return (
    <NodeViewWrapper
      as="div"
      className="math-block-wrap my-3"
      data-latex={latex}
    >
      {editing ? (
        <div className="border border-[#0052cc] rounded p-2 bg-[#f4f8ff]">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            placeholder={"\\int_0^1 x^2\\, dx"}
            rows={3}
            className="w-full font-mono text-[12px] bg-white border border-[#dfe1e6] rounded p-1 outline-none"
          />
          <div className="text-[11px] text-[#6b778c] mt-1">
            Ctrl+Enter로 적용 · Esc로 취소
          </div>
        </div>
      ) : (
        <div
          onClick={() => {
            if (editor.isEditable) setEditing(true);
          }}
          className={
            editor.isEditable
              ? "cursor-pointer hover:bg-[#f4f8ff] rounded p-1"
              : "p-1"
          }
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  );
}
