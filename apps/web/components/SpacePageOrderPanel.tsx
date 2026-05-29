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

// Cycle 74-E (개정) — 공간 도구 '페이지 순서' 탭.
//   홈(메인 페이지)을 최상단에 고정하고, 나머지 발행 페이지를 실제 parentId 트리로
//   표시. 드래그=같은 상위 안 순서 변경, → 버튼=바로 위 형제의 하위로(들여쓰기),
//   ← 버튼=상위 밖으로(내어쓰기). 모두 즉시 PATCH /pages/:id 후 ["spaces"] 갱신.
type FlatItem = {
  id: string;
  title: string;
  depth: number;
  parentId: string | null;
  isHome: boolean;
};

function buildFlat(pages: PageNode[], homeId: string | null): FlatItem[] {
  const pub = pages.filter((p) => p.publishedAt); // 미발행 draft 제외
  const byParent = new Map<string | null, PageNode[]>();
  for (const p of pub) {
    const key = p.parentId ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(p);
    byParent.set(key, arr);
  }
  const out: FlatItem[] = [];
  const walk = (parentId: string | null, depth: number) => {
    // Cycle 78 — 홈도 다른 페이지와 동일하게 실제 position 순서로 표시(핀 제거).
    const group = byParent.get(parentId) ?? [];
    for (const p of group) {
      out.push({
        id: p.id,
        title: p.title,
        depth,
        parentId: p.parentId ?? null,
        isHome: p.id === homeId,
      });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function Row({
  item,
  canIndent,
  canOutdent,
  onIndent,
  onOutdent,
}: {
  item: FlatItem;
  canIndent: boolean;
  canOutdent: boolean;
  onIndent: () => void;
  onOutdent: () => void;
}) {
  // Cycle 78 — 홈도 다른 페이지와 동일하게 드래그/들여쓰기 가능. 🏠/(홈) 표시만 유지.
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
      className={`flex items-center gap-2 px-2 py-1.5 mb-1 rounded border text-[13px] ${
        isDragging
          ? "border-[#0052cc] bg-white opacity-60"
          : item.isHome
            ? "border-[#dfe1e6] bg-[#f4f5f7]"
            : "border-[#dfe1e6] bg-white"
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        className="text-[#a5adba] cursor-grab active:cursor-grabbing select-none"
        title="드래그하여 순서 변경"
      >
        ⠿
      </span>
      <span className="flex-1 truncate text-[#172b4d]">
        {item.isHome && <span className="mr-1">🏠</span>}
        {item.title || "(제목 없음)"}
        {item.isHome && (
          <span className="ml-1 text-[11px] text-[#6b778c]">(홈)</span>
        )}
      </span>
      <span className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onOutdent}
          disabled={!canOutdent}
          title="상위 밖으로 (내어쓰기)"
          className="px-1.5 py-0.5 text-[12px] rounded text-[#42526e] hover:bg-[#ebecf0] disabled:text-[#c1c7d0] disabled:hover:bg-transparent"
        >
          ←
        </button>
        <button
          type="button"
          onClick={onIndent}
          disabled={!canIndent}
          title="인접한 페이지의 하위로 (들여쓰기)"
          className="px-1.5 py-0.5 text-[12px] rounded text-[#42526e] hover:bg-[#ebecf0] disabled:text-[#c1c7d0] disabled:hover:bg-transparent"
        >
          →
        </button>
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
  const homeId = space?.homePageId ?? null;
  const items = useMemo(
    () => buildFlat(space?.pages ?? [], homeId),
    [space, homeId],
  );
  const sortableIds = items.map((i) => i.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const patch = useMutation({
    mutationFn: async (v: {
      id: string;
      body: { parentId?: string | null; position?: number };
    }) => {
      const r = await fetch(`/api/pages/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(v.body),
      });
      if (!r.ok) throw new Error("update failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spaces"] }),
    onError: () => window.alert("페이지 순서/계층 변경에 실패했습니다."),
  });

  const siblingsOf = (parentId: string | null) =>
    items.filter((i) => i.parentId === parentId);

  // Cycle 79 — 인접 형제의 하위로 들여쓰기. 보통 바로 위(이전) 형제,
  //   첫 형제(예: 홈)는 위 형제가 없으니 바로 아래(다음) 형제의 하위로.
  const onIndent = (item: FlatItem) => {
    const sibs = siblingsOf(item.parentId);
    const idx = sibs.findIndex((s) => s.id === item.id);
    const target = idx > 0 ? sibs[idx - 1] : sibs[idx + 1];
    if (!target) return; // 형제가 하나뿐이면 들여쓸 대상 없음
    patch.mutate({ id: item.id, body: { parentId: target.id } });
  };

  const onOutdent = (item: FlatItem) => {
    if (item.parentId === null) return; // 이미 루트
    const parent = items.find((i) => i.id === item.parentId);
    patch.mutate({ id: item.id, body: { parentId: parent?.parentId ?? null } });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = items.find((i) => i.id === active.id);
    const b = items.find((i) => i.id === over.id);
    if (!a || !b) return;
    if (a.parentId !== b.parentId) {
      window.alert(
        "순서 변경은 같은 상위 안에서만 됩니다. 계층 이동은 → / ← 버튼을 쓰세요.",
      );
      return;
    }
    const sibs = siblingsOf(a.parentId);
    const newIndex = sibs.findIndex((s) => s.id === b.id);
    if (newIndex < 0) return;
    patch.mutate({ id: a.id, body: { position: newIndex } });
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
        ⠿ 드래그로 같은 상위 안 순서 변경 · → 인접한 페이지의 하위로 ·
        ← 상위 밖으로. 홈 페이지도 동일하게 조절됩니다. 변경은 즉시 저장됩니다.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          <div>
            {items.map((it) => {
              const sibs = siblingsOf(it.parentId);
              return (
                <Row
                  key={it.id}
                  item={it}
                  canIndent={sibs.length > 1}
                  canOutdent={it.parentId !== null}
                  onIndent={() => onIndent(it)}
                  onOutdent={() => onOutdent(it)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
