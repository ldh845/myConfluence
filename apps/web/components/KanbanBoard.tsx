"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/useAuth";
import KanbanColumn, { type ColumnKey } from "./KanbanColumn";
import type { BoardPage } from "./KanbanCard";
import { STATUS_META } from "./PageStatusBadge";
import type { PageStatus } from "@/lib/types";

// Cycle 71 — 스페이스 칸반 보드. /?spaceId=X&view=board 에서 마운트.
//   GET /pages/board 로 공간 전체 발행 페이지를 받아 4컬럼(상태 없음/To Do/
//   In Progress/Done)으로 그룹핑. 카드 드래그 → 다른 컬럼 드롭 시 PATCH
//   /pages/:id/status (optimistic). 권한(작성자/ADMIN) 없는 카드는 드래그 비활성.

const COLUMNS: { key: ColumnKey; label: string; color: string }[] = [
  { key: "NONE", label: "상태 없음", color: "#c1c7d0" },
  { key: "TODO", label: STATUS_META.TODO.label, color: STATUS_META.TODO.dot },
  {
    key: "IN_PROGRESS",
    label: STATUS_META.IN_PROGRESS.label,
    color: STATUS_META.IN_PROGRESS.dot,
  },
  { key: "DONE", label: STATUS_META.DONE.label, color: STATUS_META.DONE.dot },
];

const columnOf = (s: PageStatus | null | undefined): ColumnKey => s ?? "NONE";

export default function KanbanBoard({
  spaceId,
  spaceName,
}: {
  spaceId: string;
  spaceName?: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pages, setPages] = useState<BoardPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/pages/board?spaceId=${encodeURIComponent(spaceId)}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BoardPage[]) => {
        if (!cancelled) setPages(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const canEdit = (p: BoardPage) =>
    !!user && (user.role === "ADMIN" || p.author?.id === user.id);

  const grouped = useMemo(() => {
    const g: Record<ColumnKey, BoardPage[]> = {
      NONE: [],
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    for (const p of pages) g[columnOf(p.status)].push(p);
    return g;
  }, [pages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over) return;
    const pageId = String(e.active.id);
    const target = String(e.over.id) as ColumnKey;
    const page = pages.find((p) => p.id === pageId);
    if (!page || columnOf(page.status) === target) return;

    const nextStatus: PageStatus | null = target === "NONE" ? null : target;
    const prev = pages;
    setPages((cur) =>
      cur.map((p) => (p.id === pageId ? { ...p, status: nextStatus } : p)),
    );
    try {
      const r = await fetch(`/api/pages/${pageId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!r.ok) throw new Error("status change failed");
      queryClient.invalidateQueries({ queryKey: ["pages-recent"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    } catch {
      setPages(prev); // 롤백
      window.alert("상태 변경에 실패했습니다.");
    }
  };

  return (
    <div className="px-6 pt-6 pb-16">
      <h1 className="text-[22px] font-semibold text-[#172b4d] mb-4">
        {spaceName ? `${spaceName} · 보드` : "보드"}
      </h1>
      {loading ? (
        <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {COLUMNS.map((c) => (
              <KanbanColumn
                key={c.key}
                columnKey={c.key}
                label={c.label}
                color={c.color}
                pages={grouped[c.key]}
                canEdit={canEdit}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}
