"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PageStatus } from "@/lib/types";
import PageStatusBadge, { STATUS_META } from "./PageStatusBadge";

// Cycle 70 — 페이지 작업 상태 배지 + 변경 드롭다운(페이지 헤더/편집기용).
//   - canEdit=true(작성자/ADMIN): 배지 클릭 → 메뉴(To Do/In Progress/Done/상태 제거),
//     현재 상태 ✓, 외부클릭·Esc 닫힘. 선택 시 PATCH + optimistic 반영.
//   - canEdit=false: 배지만(클릭 불가) + "상태 변경 권한이 없습니다" 툴팁.
//   currentPage 가 react-query 캐시가 아니라 useState 라(헤더), 즉시 반영은 자체
//   optimistic state 로 처리하고 목록/피드 쿼리만 무효화한다.
//   ⚠️ 권한 가드는 백엔드(PATCH /pages/:id/status)가 최종 — 여기 canEdit 은 UX 용.

const OPTIONS: PageStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

export default function PageStatusDropdown({
  pageId,
  status,
  canEdit,
}: {
  pageId: string;
  status: PageStatus | null | undefined;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState<PageStatus | null>(status ?? null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 페이지 전환 / 서버값 변경 시 로컬 상태 동기화.
  useEffect(() => setCurrent(status ?? null), [pageId, status]);

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

  const apply = async (next: PageStatus | null) => {
    setOpen(false);
    if (next === current) return;
    const prev = current;
    setCurrent(next); // optimistic
    setPending(true);
    try {
      const r = await fetch(`/api/pages/${pageId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      if (!r.ok) throw new Error("status change failed");
      // 다른 화면(최근 작업 / 저장 목록 / 활동 피드)도 갱신.
      queryClient.invalidateQueries({ queryKey: ["pages-recent"] });
      queryClient.invalidateQueries({ queryKey: ["my-saves"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    } catch {
      setCurrent(prev); // 롤백
      window.alert("상태 변경에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  // 상태 없음 + 권한 없음 → 아무것도 표시 안 함(깔끔).
  if (!current && !canEdit) return null;

  // 권한 없음 → 배지만(클릭 불가) + 툴팁.
  if (!canEdit) {
    return (
      <span title="상태 변경 권한이 없습니다" className="cursor-default">
        <PageStatusBadge status={current} />
      </span>
    );
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        title="작업 상태 변경"
        className="inline-flex items-center rounded-[3px] hover:opacity-80 disabled:opacity-50"
      >
        {current ? (
          <PageStatusBadge status={current} />
        ) : (
          <span className="inline-flex items-center gap-1 rounded-[3px] border border-dashed border-[#c1c7d0] px-1.5 py-0.5 text-[11px] font-medium leading-none text-[#6b778c]">
            + 상태
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-[170px] bg-white border border-[#dfe1e6] rounded-md shadow-lg z-30 py-1">
          {OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => apply(s)}
              className="w-full text-left px-3 py-1.5 text-[13px] text-[#172b4d] hover:bg-[#deebff] flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: STATUS_META[s].dot }}
                />
                {STATUS_META[s].label}
              </span>
              {current === s && (
                <span className="text-[#0052cc] text-[12px]">✓</span>
              )}
            </button>
          ))}
          <div className="my-1 border-t border-[#dfe1e6]" />
          <button
            type="button"
            onClick={() => apply(null)}
            className="w-full text-left px-3 py-1.5 text-[13px] text-[#6b778c] hover:bg-[#ebecf0] flex items-center justify-between gap-2"
          >
            상태 제거
            {current == null && (
              <span className="text-[#0052cc] text-[12px]">✓</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
