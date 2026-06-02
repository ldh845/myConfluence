"use client";

import { useDraggable } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import PageStatusBadge from "./PageStatusBadge";
import { relativeTime } from "@/lib/activity-format";
import type { PageStatus } from "@/lib/types";

// Cycle 71 — 칸반 카드. 권한(작성자/ADMIN) 있으면 드래그 가능, 없으면 비활성+툴팁.
//   카드 클릭 → 해당 페이지로 이동. 드래그 활성화는 8px 이동(보드의 PointerSensor)
//   이후라 단순 클릭은 이동으로 동작.
export type BoardPage = {
  id: string;
  title: string;
  status: PageStatus | null;
  updatedAt: string;
  author?: { id: string; name: string } | null;
};

export default function KanbanCard({
  page,
  canEdit,
}: {
  page: BoardPage;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: page.id, disabled: !canEdit });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => router.push(`/?pageId=${page.id}`)}
      title={canEdit ? undefined : "상태 변경 권한이 없습니다"}
      className={`rounded-md border border-[#dfe1e6] bg-white p-2.5 shadow-sm ${
        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      } ${isDragging ? "opacity-50" : "hover:border-[#0052cc]"}`}
    >
      <div className="text-[13px] font-medium text-[#172b4d] line-clamp-2">
        {page.title || "(제목 없음)"}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#6b778c]">
        <span className="truncate">{page.author?.name ?? "익명"}</span>
        <span className="shrink-0">{relativeTime(page.updatedAt)}</span>
      </div>
      {page.status && (
        <div className="mt-1.5">
          <PageStatusBadge status={page.status} />
        </div>
      )}
    </div>
  );
}
