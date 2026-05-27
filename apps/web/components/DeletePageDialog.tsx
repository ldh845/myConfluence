"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Cycle 56 — 페이지 삭제 확인 다이얼로그. 기존 window.confirm 교체.
//   하위 페이지가 있을 때만 체크박스 노출 ("하위 페이지도 삭제").
//   - 체크 X (기본) → cascade=false: 자식 부모로 승격 + 부모만 휴지통
//   - 체크 O → cascade=true: 자손 모두 휴지통 (Cycle 18-1a 동작)
//   - 자식 없으면 cascade 옵션 무관, 체크박스 안 보임

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pageTitle: string;
  childCount: number;
  onConfirm: (cascade: boolean) => void;
};

export default function DeletePageDialog({
  open,
  onOpenChange,
  pageTitle,
  childCount,
  onConfirm,
}: Props) {
  const hasChildren = childCount > 0;
  const [cascade, setCascade] = useState(false);

  // 열릴 때마다 체크박스 초기화 (이전 선택이 누적되지 않도록).
  useEffect(() => {
    if (open) setCascade(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>페이지 삭제</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-[13px] text-[#172b4d]">
          <div>
            <span className="font-semibold">&ldquo;{pageTitle || "(제목 없음)"}&rdquo;</span>
            을(를) 삭제합니다.
          </div>

          {hasChildren && (
            <>
              <div className="text-[#6b778c]">
                {cascade
                  ? `이 페이지와 ${childCount}개의 하위 페이지가 모두 휴지통으로 이동합니다.`
                  : `${childCount}개의 하위 페이지가 페이지 트리에 남습니다 (한 단계 위로 승격).`}
              </div>
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cascade}
                  onChange={(e) => setCascade(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">하위 페이지도 삭제</span>
                  <span className="block text-[11px] text-[#6b778c]">
                    {childCount}개의 직접 하위 페이지 + 그 아래 모든 자손
                  </span>
                </span>
              </label>
            </>
          )}

          {!hasChildren && (
            <div className="text-[#6b778c]">휴지통으로 이동합니다.</div>
          )}
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
            onClick={() => {
              onConfirm(cascade);
              onOpenChange(false);
            }}
            className="px-3 py-1.5 text-[12px] rounded bg-[#de350b] text-white hover:bg-[#bf2600]"
          >
            삭제
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
