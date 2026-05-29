"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PageNode, SpaceWithPages } from "@/lib/types";
import { useFavoritesStore } from "@/lib/stores/useFavoritesStore";
import { useAuth } from "@/lib/auth/useAuth";
import { canManageSpace } from "@/lib/spacePermission";
import SpaceStarButton from "@/components/SpaceStarButton";
import DeletePageDialog from "@/components/DeletePageDialog";
import AppIcon from "@/components/AppIcon";

// Cycle 74 — 공간 도구 드롭다운 메뉴 항목(= SpaceSettings 탭). enabled=false 는 준비 중.
const SPACE_TOOL_ITEMS: { id: string; label: string; enabled: boolean }[] = [
  { id: "overview", label: "개요", enabled: true },
  { id: "permissions", label: "권한", enabled: true },
  { id: "audit", label: "감사 로그", enabled: true },
  { id: "order", label: "페이지 순서", enabled: true },
  { id: "sidebar", label: "사이드바 구성", enabled: false },
];

type Props = {
  space: SpaceWithPages | null;
  selectedPageId: string | null;
  onSelect: (pageId: string) => void;
  onCreatePage: (spaceId: string, parentId: string | null) => void;
  // Cycle 56 — cascade 옵션. true 면 자손 모두 휴지통, false 면 자식 승격 후 단일.
  onDeletePage: (pageId: string, cascade: boolean) => void;
  onOpenTrash?: () => void;
  onReorder?: () => void;
};

// FR-021 (Cycle 19b) — 사이드바 트리 DnD.
// 펼쳐진 노드만 평탄 리스트로 만들고 SortableContext에 등록. drop hint는
// over rect의 상단 1/3 / 중앙 1/3 / 하단 1/3 으로 before/child/after 결정.

type FlatItem = {
  id: string;
  title: string;
  parentId: string | null;
  spaceId: string;
  position: number;
  depth: number;
  hasChildren: boolean;
};

type DropHint = "before" | "after" | "child" | null;

// 펼쳐진(collapsed에 없는) 노드를 따라가 평탄 리스트 생성.
function flattenVisible(
  pages: PageNode[],
  collapsed: Set<string>,
): FlatItem[] {
  type Node = PageNode & { children: Node[] };
  const byId = new Map<string, Node>();
  pages.forEach((p) => byId.set(p.id, { ...p, children: [] }));
  const roots: Node[] = [];
  byId.forEach((n) => {
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId)!.children.push(n);
    } else {
      roots.push(n);
    }
  });
  const flat: FlatItem[] = [];
  let positionMap: Map<string, number> | null = null;
  // PageNode에는 position이 없으니, 같은 부모 그룹 안 createdAt 순서로 인덱스 부여.
  // 백엔드는 position 기준 정렬 — drop target 계산 시엔 그 순서를 그대로 사용.
  const visit = (n: Node, depth: number, indexInParent: number) => {
    flat.push({
      id: n.id,
      title: n.title,
      parentId: n.parentId,
      spaceId: n.spaceId,
      position: indexInParent,
      depth,
      hasChildren: n.children.length > 0,
    });
    if (!collapsed.has(n.id)) {
      n.children.forEach((c, i) => visit(c, depth + 1, i));
    }
  };
  void positionMap;
  roots.forEach((r, i) => visit(r, 0, i));
  return flat;
}

function collectSubtreeIds(pages: PageNode[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  pages.forEach((p) => {
    if (!p.parentId) return;
    const arr = childrenByParent.get(p.parentId) ?? [];
    arr.push(p.id);
    childrenByParent.set(p.parentId, arr);
  });
  const set = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const kids = childrenByParent.get(cur) ?? [];
    for (const k of kids) {
      if (!set.has(k)) {
        set.add(k);
        queue.push(k);
      }
    }
  }
  return set;
}

function NavItem({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm text-left ${
        active
          ? "bg-[#deebff] text-[#0052cc] font-semibold"
          : disabled
          ? "text-[#a5adba] cursor-not-allowed"
          : "text-[#172b4d] hover:bg-[#ebecf0]"
      }`}
    >
      <span className="w-4 inline-flex items-center justify-center text-center">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

function SortableTreeRow({
  item,
  selected,
  collapsedHas,
  toggleCollapsed,
  onSelect,
  onCreatePage,
  onRequestDelete,
  dropHint,
  isOverTarget,
}: {
  item: FlatItem;
  selected: boolean;
  collapsedHas: boolean;
  toggleCollapsed: (id: string) => void;
  onSelect: (id: string) => void;
  onCreatePage: (spaceId: string, parentId: string | null) => void;
  // Cycle 56 — confirm 제거. 부모(Sidebar)가 다이얼로그를 띄움.
  onRequestDelete: (item: FlatItem) => void;
  dropHint: DropHint;
  isOverTarget: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: 8 + item.depth * 16,
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      aria-label={`페이지 '${item.title}' 드래그하여 위치 변경`}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(item.id)}
      className={`group flex items-center gap-1 pr-2 py-1 rounded cursor-pointer text-sm relative ${
        selected
          ? "bg-[#deebff] text-[#0052cc] font-semibold"
          : "text-[#172b4d] hover:bg-[#ebecf0]"
      } ${
        isOverTarget && dropHint === "child"
          ? "bg-[#deebff] ring-1 ring-[#0052cc]"
          : ""
      }`}
    >
      {/* drop indicator: before / after */}
      {isOverTarget && dropHint === "before" && (
        <div className="absolute left-0 right-0 top-0 h-[2px] bg-[#0052cc] pointer-events-none" />
      )}
      {isOverTarget && dropHint === "after" && (
        <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#0052cc] pointer-events-none" />
      )}

      <button
        onClick={(e) => {
          stop(e);
          if (item.hasChildren) toggleCollapsed(item.id);
        }}
        onPointerDown={stop}
        className="w-4 text-[#6b778c] text-[11px] flex items-center justify-center shrink-0"
        aria-label={item.hasChildren ? "하위 페이지 펼치기/접기" : undefined}
      >
        {item.hasChildren ? (
          collapsedHas ? "›" : "⌄"
        ) : (
          <span className="text-[#a5adba]">•</span>
        )}
      </button>
      <span className="flex-1 truncate">{item.title}</span>
      <button
        title="하위 페이지 추가"
        className="opacity-0 group-hover:opacity-100 text-[#6b778c] hover:text-[#0052cc] px-1"
        onClick={(e) => {
          stop(e);
          onCreatePage(item.spaceId, item.id);
        }}
        onPointerDown={stop}
      >
        ＋
      </button>
      <button
        title="삭제"
        className="opacity-0 group-hover:opacity-100 text-[#6b778c] hover:text-[#de350b] px-1"
        onClick={(e) => {
          stop(e);
          // Cycle 56 — window.confirm 제거. 부모가 DeletePageDialog 띄움
          // (자식 카운트 + cascade 체크박스).
          onRequestDelete(item);
        }}
        onPointerDown={stop}
      >
        ×
      </button>
    </div>
  );
}

export default function Sidebar({
  space,
  selectedPageId,
  onSelect,
  onCreatePage,
  onDeletePage,
  onOpenTrash,
  onReorder,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Cycle 51 — "페이지" 메뉴의 active 표시에 view 파라미터를 본다.
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  // Cycle 74-B — '공간 도구'는 SITE 공간을 관리할 수 있는 사용자에게만 노출.
  const { user } = useAuth();
  // Cycle 74 (개정) — 개인 공간도 소유자에게 '공간 도구' 노출(canManageSpace 가
  //   PERSONAL=소유자 판정). 단 권한(멤버) 탭은 개인 공간엔 부적합 → 드롭다운에서 제외.
  const canManage = !!space && canManageSpace(space, user);
  const toolItems =
    space?.type === "PERSONAL"
      ? SPACE_TOOL_ITEMS.filter((i) => i.id !== "permissions")
      : SPACE_TOOL_ITEMS;
  // Cycle 74 — '공간 도구' 위로 열리는 드롭다운. 외부클릭/Esc 닫힘.
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!toolsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [toolsOpen]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Cycle 56 — 페이지 삭제 다이얼로그(자식 카운트 + cascade 체크박스) 마운트 후보.
  const [deleteReq, setDeleteReq] = useState<
    | { id: string; title: string; childCount: number }
    | null
  >(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint>(null);

  const pages = space?.pages ?? [];

  // "홈" — 이 공간의 메인 페이지. Cycle 33: Space.homePageId 명시적 지정 우선,
  // 없으면(백필 누락 등) 첫 루트 페이지로 fallback.
  const mainPageId = useMemo(() => {
    if (space?.homePageId && pages.some((p) => p.id === space.homePageId)) {
      return space.homePageId;
    }
    const roots = pages.filter((p) => !p.parentId);
    return roots[0]?.id ?? null;
  }, [pages, space?.homePageId]);

  // 페이지 트리에는 메인 페이지를 제외. 메인 페이지의 직계 자식은 루트로 승격.
  // Cycle 35 — 미발행 draft(publishedAt=null)도 숨긴다. 발행해야 트리 등장.
  // publishedAt 필드가 응답에 빠진 레거시 페이지는 보수적으로 노출(undefined → 통과).
  const treePages = useMemo(() => {
    const filtered = pages.filter(
      (p) => p.id !== mainPageId && p.publishedAt !== null,
    );
    if (!mainPageId) return filtered;
    return filtered.map((p) =>
      p.parentId === mainPageId ? { ...p, parentId: null } : p,
    );
  }, [pages, mainPageId]);

  const visible = useMemo(
    () => flattenVisible(treePages, collapsed),
    [treePages, collapsed],
  );

  // FR-025 (Cycle 18-2) — 활성 스페이스의 즐겨찾기 페이지만 노출.
  const favIds = useFavoritesStore((s) => s.ids);
  const favPages = useMemo(() => {
    if (!space) return [];
    return space.pages.filter((p) => favIds.includes(p.id));
  }, [space, favIds]);

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation<
    void,
    Error,
    { id: string; parentId: string | null; position: number }
  >({
    mutationFn: async ({ id, parentId, position }) => {
      const r = await fetch(`/api/pages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ parentId, position }),
      });
      if (!r.ok) {
        let msg = "이동에 실패했습니다.";
        try {
          const b = (await r.json()) as { error?: string };
          if (b?.error === "cannot move under own descendant") {
            msg = "자기 자신의 하위 페이지로는 이동할 수 없습니다.";
          } else if (b?.error === "cannot be parent of itself") {
            msg = "자기 자신을 부모로 지정할 수 없습니다.";
          } else if (b?.error) {
            msg = b.error;
          }
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
    },
    onSettled: () => onReorder?.(),
    onError: (err) => window.alert(err.message),
  });

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const onDragOver = (e: DragOverEvent) => {
    const overIdNow = e.over?.id ? String(e.over.id) : null;
    if (!overIdNow) {
      setOverId(null);
      setDropHint(null);
      return;
    }
    if (overIdNow === e.active.id) {
      setOverId(null);
      setDropHint(null);
      return;
    }
    // active의 자손은 drop target 제외.
    const subtree = collectSubtreeIds(treePages, String(e.active.id));
    if (subtree.has(overIdNow)) {
      setOverId(null);
      setDropHint(null);
      return;
    }
    const overRect = e.over!.rect;
    const activeY =
      e.active.rect.current.translated?.top ??
      e.active.rect.current.initial?.top ??
      0;
    // 활성 행 상단 Y를 over rect 안에서의 상대 위치로 환산해 1/3 구간 결정.
    const relY = (activeY - overRect.top) / overRect.height;
    let hint: DropHint;
    if (relY < 0.33) hint = "before";
    else if (relY > 0.66) hint = "after";
    else hint = "child";
    setOverId(overIdNow);
    setDropHint(hint);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const finalActiveId = String(e.active.id);
    const finalOverId = overId;
    const finalHint = dropHint;
    setActiveId(null);
    setOverId(null);
    setDropHint(null);

    if (!finalOverId || !finalHint) return;
    if (finalOverId === finalActiveId) return;

    const over = treePages.find((p) => p.id === finalOverId);
    const active = treePages.find((p) => p.id === finalActiveId);
    if (!over || !active) return;

    // 자손 drop 차단 (안전망 — onDragOver에서 이미 처리되지만 race 방지).
    const subtree = collectSubtreeIds(treePages, finalActiveId);
    if (subtree.has(finalOverId)) return;

    let targetParentId: string | null;
    let targetPosition: number;

    if (finalHint === "child") {
      // over 노드의 첫 자식으로
      targetParentId = over.id;
      targetPosition = 0;
      // over 자동 펼침
      setCollapsed((prev) => {
        if (!prev.has(over.id)) return prev;
        const next = new Set(prev);
        next.delete(over.id);
        return next;
      });
    } else {
      // before / after over (over의 형제로)
      targetParentId = over.parentId;
      const siblings = treePages
        .filter(
          (p) =>
            p.parentId === over.parentId &&
            p.spaceId === over.spaceId &&
            p.id !== finalActiveId,
        )
        // pages는 spaces include에서 (position asc) 정렬되어 들어옴.
        // 정렬 보존: 같은 부모 안에선 입력 순서가 곧 position 순서.
        ;
      const overIdx = siblings.findIndex((p) => p.id === over.id);
      targetPosition = finalHint === "before" ? overIdx : overIdx + 1;
      if (overIdx < 0) targetPosition = siblings.length; // 안전 fallback
    }

    reorder.mutate({
      id: finalActiveId,
      parentId: targetParentId,
      position: targetPosition,
    });
  };

  const activeItem = activeId
    ? visible.find((v) => v.id === activeId) ?? null
    : null;

  return (
    <aside className="w-[260px] shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] h-full overflow-y-auto flex flex-col">
      {space && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#dfe1e6]">
          <div className="w-8 h-8 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold">
            {space.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[#172b4d] truncate">
              {space.name}
            </div>
            <div className="text-[11px] text-[#6b778c] truncate">
              {space.description ?? "공간"}
            </div>
          </div>
          {/* Cycle 29 (별표) — 스페이스 별표 토글. SystemSidebar/TopNav/홈과 store 공유. */}
          <SpaceStarButton spaceId={space.id} size="md" alwaysVisible />
        </div>
      )}

      <div className="px-2 py-2 space-y-0.5">
        {/* 홈 — 이 공간의 메인 페이지(첫 루트 페이지)로 이동. */}
        <NavItem
          icon={<AppIcon name="home" size={15} alt="" />}
          label="홈"
          active={
            pathname === "/" &&
            !!mainPageId &&
            selectedPageId === mainPageId
          }
          onClick={() => {
            if (mainPageId) onSelect(mainPageId);
            else if (space) router.push(`/?spaceId=${space.id}`);
          }}
        />
        {/* Cycle 51 — "페이지" 메뉴 동작 변경: 첫 페이지 자동 이동 폐기.
            이제는 그 공간의 최근 업데이트 페이지 목록 화면(SpacePagesView,
            (app)/page.tsx 가 view=pages 분기) 으로 이동한다. 빈 스페이스도
            동일 화면이 빈 상태 안내 + 만들기 버튼을 책임진다. */}
        <NavItem
          icon={<AppIcon name="page" size={15} alt="" />}
          label="페이지"
          active={pathname === "/" && view === "pages"}
          onClick={() => {
            if (space) router.push(`/?spaceId=${space.id}&view=pages`);
          }}
        />
        {/* Cycle 71 — 칸반 보드 진입점. */}
        <NavItem
          icon={<AppIcon name="chart" size={15} alt="" />}
          label="보드"
          active={pathname === "/" && view === "board"}
          onClick={() => {
            if (space) router.push(`/?spaceId=${space.id}&view=board`);
          }}
        />
        <NavItem
          icon={<AppIcon name="calendar" size={15} alt="" />}
          label="캘린더"
          disabled
        />
      </div>

      {favPages.length > 0 && (
        <>
          <div className="border-t border-[#dfe1e6] mx-2" />
          <div className="px-4 pt-3 pb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
            <AppIcon name="star" size={12} alt="" /> 즐겨찾기
          </div>
          <ul className="px-2 pb-1 space-y-0.5">
            {favPages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={`w-full text-left px-2 py-1 text-sm rounded truncate ${
                    selectedPageId === p.id
                      ? "bg-[#deebff] text-[#0052cc] font-semibold"
                      : "text-[#172b4d] hover:bg-[#ebecf0]"
                  }`}
                >
                  {p.title || "(제목 없음)"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="border-t border-[#dfe1e6] mx-2" />

      <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
        공간 바로가기
      </div>
      <div className="px-2 pb-1 text-[12px] text-[#6b778c]">
        <div className="px-3 py-1">빠른 링크가 없습니다</div>
      </div>

      <div className="border-t border-[#dfe1e6] mx-2 my-1" />

      <div className="px-4 pt-2 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
          페이지 트리
        </span>
      </div>

      <div className="px-2 pb-4 flex-1">
        {visible.length === 0 && (
          <div className="text-xs text-[#6b778c] px-3 py-2">
            페이지가 없습니다.
          </div>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={visible.map((v) => v.id)}
            strategy={verticalListSortingStrategy}
          >
            {visible.map((v) => (
              <SortableTreeRow
                key={v.id}
                item={v}
                selected={selectedPageId === v.id}
                collapsedHas={collapsed.has(v.id)}
                toggleCollapsed={toggleCollapsed}
                onSelect={onSelect}
                onCreatePage={onCreatePage}
                onRequestDelete={(item) => {
                  // Cycle 56 — 직접 활성 자식 카운트(휴지통 제외). pages 는
                  // 이미 활성만(remove 후 invalidate 로 갱신).
                  const cc = pages.filter(
                    (p) => p.parentId === item.id,
                  ).length;
                  setDeleteReq({
                    id: item.id,
                    title: item.title,
                    childCount: cc,
                  });
                }}
                dropHint={overId === v.id ? dropHint : null}
                isOverTarget={overId === v.id}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeItem ? (
              <div className="px-2 py-1 rounded bg-white border border-[#dfe1e6] shadow text-sm text-[#172b4d]">
                📄 {activeItem.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="border-t border-[#dfe1e6] px-4 py-2 space-y-1">
        <button
          type="button"
          onClick={() => onOpenTrash?.()}
          className="flex items-center gap-2 text-sm text-[#172b4d] hover:text-[#0052cc]"
        >
          <AppIcon name="trash" size={15} alt="" /> 휴지통
        </button>
        {/* Cycle 74-B/74 — Space Admin/전역 ADMIN 에게만 노출. 클릭 → 위로 열리는
            드롭다운, 항목 선택 시 해당 탭으로 공간 도구 페이지 진입. */}
        {canManage && space && (
          <div className="relative" ref={toolsRef}>
            <button
              type="button"
              onClick={() => setToolsOpen((v) => !v)}
              className={`flex items-center gap-2 text-sm hover:text-[#0052cc] ${
                pathname === "/" && view === "settings"
                  ? "text-[#0052cc] font-semibold"
                  : "text-[#172b4d]"
              }`}
            >
              <span>⚙️</span> 공간 도구
            </button>
            {toolsOpen && (
              <div className="absolute left-0 bottom-full mb-1 w-[180px] bg-white border border-[#dfe1e6] rounded-md shadow-lg py-1 z-30">
                {toolItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    disabled={!it.enabled}
                    onClick={() => {
                      if (!it.enabled) return;
                      setToolsOpen(false);
                      router.push(
                        `/?spaceId=${space.id}&view=settings&tab=${it.id}`,
                      );
                    }}
                    title={it.enabled ? undefined : "준비 중"}
                    className={`w-full text-left px-3 py-1.5 text-[13px] ${
                      it.enabled
                        ? "text-[#172b4d] hover:bg-[#deebff]"
                        : "text-[#a5adba] cursor-not-allowed"
                    }`}
                  >
                    {it.label}
                    {!it.enabled && " (준비 중)"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cycle 56 — 페이지 삭제 다이얼로그 (자식 카운트 + cascade 체크박스) */}
      {deleteReq && (
        <DeletePageDialog
          open={true}
          onOpenChange={(v) => {
            if (!v) setDeleteReq(null);
          }}
          pageTitle={deleteReq.title}
          childCount={deleteReq.childCount}
          onConfirm={(cascade) => {
            onDeletePage(deleteReq.id, cascade);
            setDeleteReq(null);
          }}
        />
      )}
    </aside>
  );
}
