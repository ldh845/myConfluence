"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PageNode, SpaceWithPages } from "@/lib/types";

// Cycle 74-E — 공간 도구 '페이지 순서' 탭. 스페이스 발행 페이지 트리를 들여쓰기된
//   flat 리스트로 보여주고, 같은 상위 페이지 안에서 드래그로 순서 변경(즉시 PATCH).
//   계층(재부모) 변경은 사이드바 트리 DnD 를 그대로 사용(여기선 형제 순서만).
type FlatItem = {
  id: string;
  title: string;
  depth: number;
  parentId: string | null;
};

function flatten(pages: PageNode[]): FlatItem[] {
  const byParent = new Map<string | null, PageNode[]>();
  for (const p of pages) {
    if (!p.publishedAt) continue; // 미발행 draft 제외(사이드바와 동일 정책)
    const key = p.parentId ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(p);
    byParent.set(key, arr);
  }
  const out: FlatItem[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const p of byParent.get(parentId) ?? []) {
      out.push({ id: p.id, title: p.title, depth, parentId: p.parentId ?? null });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function Row({ item }: { item: FlatItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: item.depth * 20,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-2 py-1.5 mb-1 rounded border border-[#dfe1e6] bg-white text-[13px] cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : "hover:border-[#0052cc]"
      }`}
    >
      <span className="text-[#a5adba] select-none">⠿</span>
      <span className="truncate text-[#172b4d]">
        {item.title || "(제목 없음)"}
      </span>
    </div>
  );
}

export default function SpacePageOrderPanel({ spaceId }: { spaceId: string }) {
  const qc = useQueryClient();
  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces", { credentials: "include" });
      return r.ok ? ((await r.json()) as SpaceWithPages[]) : [];
    },
  });
  const space = (spaces ?? []).find((s) => s.id === spaceId) ?? null;
  const items = useMemo(() => flatten(space?.pages ?? []), [space]);
  const ids = items.map((i) => i.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const reorder = useMutation({
    mutationFn: async (v: { id: string; position: number }) => {
      const r = await fetch(`/api/pages/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ position: v.position }),
      });
      if (!r.ok) throw new Error("reorder failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spaces"] }),
    onError: () => window.alert("순서 변경에 실패했습니다."),
  });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = items.find((i) => i.id === active.id);
    const b = items.find((i) => i.id === over.id);
    if (!a || !b) return;
    if (a.parentId !== b.parentId) {
      window.alert("같은 상위 페이지 안에서만 순서를 바꿀 수 있습니다.");
      return;
    }
    const siblings = items.filter((i) => i.parentId === a.parentId);
    const newIndex = siblings.findIndex((s) => s.id === b.id);
    if (newIndex < 0) return;
    reorder.mutate({ id: a.id, position: newIndex });
  };

  if (items.length === 0) {
    return (
      <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
        이 공간에 발행된 페이지가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-[#6b778c]">
        드래그하여 같은 상위 페이지 안에서 순서를 바꿀 수 있습니다. 변경은 즉시
        저장됩니다. (계층 이동은 사이드바 트리에서)
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div>
            {items.map((it) => (
              <Row key={it.id} item={it} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
