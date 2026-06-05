"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AppIcon from "@/components/AppIcon";

// Cycle 85 — '정보' 패널 삽입 다이얼로그.
//   제목(선택) + '정보 아이콘 표시' 체크박스. '삽입' 시 infoPanel 노드 삽입(빈 paragraph 포함).

export default function InfoPanelDialog({
  open,
  onOpenChange,
  editor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editor: Editor | null;
}) {
  const [title, setTitle] = useState("");
  const [showIcon, setShowIcon] = useState(true);

  useEffect(() => {
    if (open) {
      setTitle("");
      setShowIcon(true);
    }
  }, [open]);

  const insert = () => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "infoPanel",
        attrs: { title: title.trim(), showIcon },
        content: [{ type: "paragraph" }],
      })
      .run();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>정보 패널</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-semibold text-[#42526e] mb-1">
              제목 (선택)
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  insert();
                }
              }}
              maxLength={120}
              placeholder="예: 참고사항"
              className="w-full px-2 py-1.5 text-[14px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[#172b4d] cursor-pointer">
            <input
              type="checkbox"
              checked={showIcon}
              onChange={(e) => setShowIcon(e.target.checked)}
            />
            정보 아이콘 표시
          </label>
          {/* 미리보기 */}
          <div>
            <div className="text-[12px] font-semibold text-[#42526e] mb-1">
              미리보기
            </div>
            <div className="rounded border-l-4 border-[#0052cc] bg-[#deebff] p-3">
              <div className="flex items-start gap-2">
                {showIcon && (
                  <span className="text-[#0052cc] leading-none mt-0.5 shrink-0">
                    <AppIcon name="information" size={18} alt="정보" />
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  {title.trim() && (
                    <div className="font-semibold text-[#172b4d] text-[14px] mb-1">
                      {title}
                    </div>
                  )}
                  <div className="text-[14px] text-[#6b778c]">
                    여기에 내용을 입력하세요…
                  </div>
                </div>
              </div>
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
            disabled={!editor}
            className="px-3 py-1.5 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
          >
            삽입
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
