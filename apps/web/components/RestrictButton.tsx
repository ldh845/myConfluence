"use client";

import { useEffect, useRef, useState } from "react";
import AppIcon from "@/components/AppIcon";

// Cycle 81 — 페이지 제한 버튼(브레드크럼 옆). 현재는 공간 권한을 따르는 '제한 없음'
//   상태만 표시(열린 자물쇠). 특정 사용자/그룹 제한은 준비 중(닫힌 자물쇠 아이콘만 안내).
//   조회(PageHeader) / 편집(FullScreenEditor) 두 화면에서 공유.
export default function RestrictButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="페이지 제한"
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] text-[#42526e] hover:bg-[#ebecf0]"
      >
        <AppIcon name="unlock" size={14} alt="제한" />
        <span>제한</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-64 bg-white border border-[#dfe1e6] rounded-md shadow-lg p-3 text-[12px]">
          <div className="flex items-center gap-2 text-[#172b4d] font-semibold">
            <AppIcon name="unlock" size={16} alt="" />
            제한 없음
          </div>
          <p className="text-[#6b778c] mt-1">
            이 페이지는 공간 권한을 따릅니다. 공간 멤버 모두가 볼 수 있습니다.
          </p>
          <div className="mt-2 flex items-center gap-2 text-[#a5adba]">
            <AppIcon name="lock" size={14} alt="" />
            특정 사용자/그룹 제한 — 준비 중
          </div>
        </div>
      )}
    </div>
  );
}
