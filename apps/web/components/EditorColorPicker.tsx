"use client";

import type { Editor } from "@tiptap/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// FR-030 부분 — 텍스트/배경 색상 공용 드롭다운.
// kind='text'   → TextStyle + Color (글자 색)
// kind='highlight' → Highlight (배경 형광펜)
// preset 첫 항목은 "기본/없음" (해당 mark 제거).

type Preset = { label: string; color: string | null };

const TEXT_PRESETS: Preset[] = [
  { label: "기본", color: null },
  { label: "빨강", color: "#ef4444" },
  { label: "주황", color: "#f97316" },
  { label: "노랑", color: "#eab308" },
  { label: "초록", color: "#22c55e" },
  { label: "파랑", color: "#3b82f6" },
  { label: "보라", color: "#a855f7" },
  { label: "회색", color: "#6b7280" },
];

const HIGHLIGHT_PRESETS: Preset[] = [
  { label: "없음", color: null },
  { label: "노랑", color: "#fef08a" },
  { label: "녹색", color: "#bbf7d0" },
  { label: "파랑", color: "#bfdbfe" },
  { label: "분홍", color: "#fbcfe8" },
  { label: "주황", color: "#fed7aa" },
];

type Props = {
  editor: Editor;
  kind: "text" | "highlight";
};

export default function EditorColorPicker({ editor, kind }: Props) {
  const presets = kind === "text" ? TEXT_PRESETS : HIGHLIGHT_PRESETS;
  const triggerLabel = kind === "text" ? "🎨" : "🖍️";
  const triggerTitle = kind === "text" ? "텍스트 색상" : "배경 색상";

  const apply = (color: string | null) => {
    const chain = editor.chain().focus();
    if (kind === "text") {
      if (color === null) chain.unsetColor().run();
      else chain.setColor(color).run();
    } else {
      if (color === null) chain.unsetHighlight().run();
      else chain.setHighlight({ color }).run();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={triggerTitle}
          className="min-w-[28px] h-7 px-2 rounded text-[13px] flex items-center justify-center text-[#42526e] hover:bg-[#ebecf0]"
        >
          {triggerLabel}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {presets.map((p, i) => (
          <div key={p.label}>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                apply(p.color);
              }}
              className="text-[12px] flex items-center gap-2"
            >
              <span
                className="w-4 h-4 rounded border border-[#dfe1e6]"
                style={
                  p.color
                    ? { backgroundColor: p.color }
                    : {
                        background:
                          "repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb 4px,#fff 4px,#fff 8px)",
                      }
                }
                aria-hidden
              />
              {p.label}
            </DropdownMenuItem>
            {i === 0 && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
