"use client";

import { useDroppable } from "@dnd-kit/core";
import KanbanCard, { type BoardPage } from "./KanbanCard";
import type { PageStatus } from "@/lib/types";

// Cycle 71 — 칸반 컬럼(드롭 영역). 헤더에 상태 색상 점 + 이름 + 카운트.
export type ColumnKey = "NONE" | PageStatus;

export default function KanbanColumn({
  columnKey,
  label,
  color,
  pages,
  canEdit,
}: {
  columnKey: ColumnKey;
  label: string;
  color: string;
  pages: BoardPage[];
  canEdit: (p: BoardPage) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });

  return (
    <div className="flex w-[280px] shrink-0 flex-col rounded-lg bg-[#f4f5f7]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#dfe1e6]">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-[13px] font-semibold text-[#172b4d]">
          {label}
        </span>
        <span className="ml-auto text-[12px] text-[#6b778c] tabular-nums">
          {pages.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] max-h-[calc(100vh-220px)] overflow-y-auto p-2 space-y-2 rounded-b-lg ${
          isOver ? "bg-[#deebff]" : ""
        }`}
      >
        {pages.length === 0 ? (
          <div className="text-[12px] text-[#6b778c] text-center py-6">
            이 상태의 페이지가 없습니다
          </div>
        ) : (
          pages.map((p) => (
            <KanbanCard key={p.id} page={p} canEdit={canEdit(p)} />
          ))
        )}
      </div>
    </div>
  );
}
