"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AppIcon from "@/components/AppIcon";

// Cycle 80 — '만들기' 모달. 네비게이션 '만들기' 옆 ⋯ 에서 열린다.
//   카드 그리드로 생성 유형을 고른다. 현재는 '빈 페이지' 하나.
//   향후 페이지 템플릿이 추가되면 같은 그리드에 카드로 노출(이번 범위 밖).

export default function CreatePageDialog({
  open,
  onOpenChange,
  onSelectBlank,
  creating = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectBlank: () => void;
  creating?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>만들기</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          <button
            type="button"
            onClick={onSelectBlank}
            disabled={creating}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-[#dfe1e6] bg-white p-4 h-28 text-[#172b4d] hover:border-[#0052cc] hover:bg-[#f4f8ff] disabled:opacity-60"
          >
            <AppIcon name="page" size={28} alt="" />
            <span className="text-[13px] font-medium">
              {creating ? "생성 중..." : "빈 페이지"}
            </span>
          </button>
        </div>

        <p className="text-[12px] text-[#6b778c] pt-2">
          페이지 템플릿은 추후 여기에 카드로 추가됩니다.
        </p>
      </DialogContent>
    </Dialog>
  );
}
