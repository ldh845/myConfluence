"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";

// FR-039 — heading 기반 자동 목차.
// editor.state.doc.descendants 로 모든 heading 노드를 순회해 level/text/pos
// 를 모은 뒤, 클릭 시 setTextSelection(pos).scrollIntoView() 로 점프한다.
// heading id를 부여하지 않는 이유: 한국어 슬러그 충돌/안정성 회피 + Yjs로
// 동시 편집되는 마크다운 본문에 sync 안 되는 메타 속성을 추가하지 않기 위함.

type TOCItem = {
  key: string;
  level: 1 | 2 | 3 | 4;
  text: string;
  pos: number;
};

const INDENT: Record<TOCItem["level"], string> = {
  1: "pl-0",
  2: "pl-3",
  3: "pl-6",
  4: "pl-9",
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
        if (![1, 2, 3, 4].includes(level)) return;
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
    editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
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
