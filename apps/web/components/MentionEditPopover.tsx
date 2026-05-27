"use client";

import { useEffect, useRef } from "react";

// Cycle 58 — 편집 모드에서 멘션 토큰 클릭 시 뜨는 작은 컨텍스트 메뉴.
//   3 항목: 연결로 이동 (새 창) / 편집 / 연결해제.

type Props = {
  /** popover 의 화면 좌표(클릭한 멘션 element 의 bottom-left 기준). */
  x: number;
  y: number;
  userId: string;
  label: string;
  onNavigate: () => void;
  onEdit: () => void;
  onUnlink: () => void;
  onClose: () => void;
};

export default function MentionEditPopover({
  x,
  y,
  userId,
  label,
  onNavigate,
  onEdit,
  onUnlink,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 + Esc 로 닫기.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // 다음 tick 에 등록 — 자기 자신 trigger 의 click 으로 즉시 닫히지 않도록.
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const itemCls =
    "w-full text-left px-3 py-1.5 text-[13px] text-[#172b4d] hover:bg-[#ebecf0]";

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 9999,
      }}
      className="min-w-[160px] bg-white border border-[#dfe1e6] rounded-md shadow-lg py-1"
    >
      <div className="px-3 py-1 text-[11px] text-[#6b778c] border-b border-[#dfe1e6]">
        @{label}
      </div>
      <button
        type="button"
        className={itemCls}
        onClick={() => {
          onNavigate();
          onClose();
        }}
        data-mention-userid={userId}
      >
        🔗 연결로 이동
      </button>
      <button
        type="button"
        className={itemCls}
        onClick={() => {
          onEdit();
          onClose();
        }}
      >
        ✏️ 편집
      </button>
      <button
        type="button"
        className={`${itemCls} text-[#de350b] hover:bg-[#ffebe6]`}
        onClick={() => {
          onUnlink();
          onClose();
        }}
      >
        ✕ 연결해제
      </button>
    </div>
  );
}
