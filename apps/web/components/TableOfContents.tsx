"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";

// FR-039 — heading 기반 자동 목차.
// editor.state.doc.descendants 로 모든 heading 노드를 순회해 level/text/pos
// 를 모은 뒤, 클릭 시 해당 위치로 스크롤한다.

type TOCItem = {
  key: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  pos: number;
};

const INDENT: Record<TOCItem["level"], string> = {
  1: "pl-0",
  2: "pl-3",
  3: "pl-6",
  4: "pl-9",
  5: "pl-12",
  6: "pl-[3.75rem]",
};

export default function TableOfContents({ editor }: { editor: Editor | null }) {
  const [items, setItems] = useState<TOCItem[]>([]);

  useEffect(() => {
    if (!editor) {
      setItems([]);
      return;
    }
    const collect = () => {
      const next: TOCItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name !== "heading") return;
        const level = node.attrs.level as number;
        if (![1, 2, 3, 4, 5, 6].includes(level)) return;
        const text = node.textContent.trim();
        if (!text) return;
        next.push({
          key: `${pos}-${text}`,
          level: level as TOCItem["level"],
          text,
          pos,
        });
      });
      setItems(next);
    };
    collect();
    editor.on("update", collect);
    editor.on("selectionUpdate", collect);
    return () => {
      editor.off("update", collect);
      editor.off("selectionUpdate", collect);
    };
  }, [editor]);

  if (items.length < 2) return null;

  const jumpTo = (pos: number) => {
    if (!editor) return;
    // 조회 모드(contenteditable=false)에서는 setNodeSelection 이 동작하지 않으므로
    // ProseMirror view 의 DOM 노드를 직접 찾아 scrollIntoView 한다.
    const { view } = editor;
    try {
      // view.nodeDOM(pos) 는 해당 pos 의 노드 DOM 요소를 반환한다.
      // heading 노드의 시작 pos 이면 <h1>~<h6> 요소를 정확히 반환.
      const dom = view.nodeDOM(pos);
      if (dom instanceof HTMLElement) {
        dom.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    } catch {
      // nodeDOM 실패 시 fallback
    }
    // fallback: domAtPos 로 위치를 찾아 가까운 heading 요소 탐색
    try {
      const domAtPos = view.domAtPos(pos);
      const el =
        domAtPos.node instanceof Text
          ? domAtPos.node.parentElement
          : (domAtPos.node as HTMLElement);
      if (el) {
        const heading = el.closest("h1,h2,h3,h4,h5,h6") ?? el;
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch {
      // 최종 fallback: 에디터 API
      editor.chain().focus().setNodeSelection(pos).scrollIntoView().run();
    }
  };

  return (
    <nav className="text-[12px]">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6b778c] mb-2">
        목차
      </div>
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              onClick={() => jumpTo(it.pos)}
              title={it.text}
              className={`w-full text-left truncate rounded px-2 py-1 text-[#42526e] hover:bg-[#ebecf0] hover:text-[#0052cc] ${
                INDENT[it.level]
              }`}
            >
              {it.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}