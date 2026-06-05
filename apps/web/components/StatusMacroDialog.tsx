"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  STATUS_COLORS,
  type StatusColorKey,
} from "@/lib/tiptap/status-badge";
import AppIcon from "@/components/AppIcon";

// Cycle 85 — '상태' 매크로 삽입 다이얼로그.
//   좌측: 제목 입력 + 색상 선택. 우측: 미리보기(새로고침 버튼).
//   '삽입' 클릭 시 editor 에 statusBadge 노드 삽입.

const COLOR_KEYS: StatusColorKey[] = [
  "gray",
  "blue",
  "green",
  "yellow",
  "red",
  "purple",
];

export default function StatusMacroDialog({
  open,
  onOpenChange,
  editor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editor: Editor | null;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState<StatusColorKey>("gray");
  // 미리보기 새로고침용 — 키 변경으로 강제 리렌더.
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    if (open) {
      setText("");
      setColor("gray");
      setPreviewKey(0);
    }
  }, [open]);

  const c = STATUS_COLORS[color];

  const insert = () => {
    const t = text.trim();
    if (!t || !editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "statusBadge",
        attrs: { text: t, color },
      })
      .run();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>상태 매크로</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4">
          {/* 좌측: 입력 */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#42526e] mb-1">
                제목
              </label>
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insert();
                  }
                }}
                maxLength={40}
                placeholder="예: 진행 중"
                className="w-full px-2 py-1.5 text-[14px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#42526e] mb-1">
                색상
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_KEYS.map((k) => {
                  const cc = STATUS_COLORS[k];
                  const active = color === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setColor(k)}
                      title={cc.label}
                      className={`px-2 py-1 rounded-[3px] text-[11px] font-semibold uppercase border ${
                        active
                          ? "border-[#0052cc] ring-2 ring-[#deebff]"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: cc.bg, color: cc.text }}
                    >
                      {cc.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 우측: 미리보기 */}
          <div className="w-40 space-y-2">
            <div className="flex items-center justify-between text-[12px] font-semibold text-[#42526e]">
              <span>미리보기</span>
              <button
                type="button"
                onClick={() => setPreviewKey((k) => k + 1)}
                title="미리보기 새로고침"
                className="text-[11px] text-[#6b778c] hover:text-[#0052cc]"
              >
                ↻
              </button>
            </div>
            <div className="min-h-[64px] border border-[#dfe1e6] rounded p-3 flex items-center justify-center bg-[#f4f5f7]">
              <span
                key={previewKey}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-semibold uppercase tracking-wide leading-none"
                style={{ backgroundColor: c.bg, color: c.text }}
              >
                <AppIcon name="tag" size={12} alt="상태" />
                {text.trim() || "상태"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#ebecf0]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={insert}
            disabled={!text.trim() || !editor}
            className="px-3 py-1.5 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
          >
            삽입
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
