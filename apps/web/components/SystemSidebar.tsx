"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SpaceWithPages } from "@/lib/types";
import { useStarredSpacesStore } from "@/lib/stores/useStarredSpacesStore";
import { useAuth } from "@/lib/auth/useAuth";
import { apiFetch } from "@/lib/api";
import { getSpaceHomePageId } from "@/lib/spaceHome";
import SpaceStarButton from "@/components/SpaceStarButton";
import SpaceAvatar from "@/components/SpaceAvatar";

// Cycle 29 — 시스템 홈(/home) 사이드바.
// 발견 / 내 작업 sub-item 은 /home?view=<id> 로 view 전환.
// 내 공간 행은 그 스페이스로 진입 (/?pageId=<첫 페이지> 또는 /?spaceId=<id>).
// collapsed=true 면 아이콘 전용 미니 사이드바 (56px).

type SubItem = { id: string; label: string };

const DISCOVER_ITEMS: SubItem[] = [
  { id: "updates", label: "모든 변경사항" },
];

const MYWORK_ITEMS: SubItem[] = [
  { id: "recent", label: "최근 작업" },
  { id: "visited", label: "최근 방문" },
  { id: "saved", label: "나중을 위해 저장" },
];

// view id 별 SVG 아이콘 (이모지 X — 표준 라인 아이콘).
function ViewIcon({ id }: { id: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "updates": // 모든 변경사항 — activity
      return (
        <svg {...common}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case "recent": // 최근 작업 — edit
      return (
        <svg {...common}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    case "visited": // 최근 방문 — clock
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "saved": // 나중을 위해 저장 — bookmark
      return (
        <svg {...common}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      );
    default:
      return null;
  }
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
      {children}
    </div>
  );
}

function SubItemLink({
  view,
  active,
  children,
}: {
  view: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/home?view=${view}`}
      className={`w-full flex items-center gap-2 pl-3 pr-3 py-1.5 rounded text-[13px] text-left ${
        active
          ? "bg-[#deebff] text-[#0052cc] font-semibold"
          : "text-[#172b4d] hover:bg-[#ebecf0]"
      }`}
    >
      <span className="shrink-0 flex items-center">
        <ViewIcon id={view} />
      </span>
      {children}
    </Link>
  );
}

export default function SystemSidebar({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const currentView = params.get("view") ?? "updates";

  const { data: spacesData } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });
  // Cycle 29 (별표) — "내 공간"은 별표한 스페이스만.
  // Cycle 49 — 사용자 토글(showPersonalSpaceInSidebar) ON 이면 본인 personal
  // space 도 '내 공간' 섹션 맨 위에 표시(별표와 dedupe). 토글 자체는 섹션
  // 헤더 옆 작은 버튼 — PATCH /api/auth/me/prefs 호출 후 ['me']·['spaces']
  // invalidate 로 즉시 갱신.
  const starredIds = useStarredSpacesStore((s) => s.ids);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const all = spacesData ?? [];
  const personalSpace =
    user?.showPersonalSpaceInSidebar
      ? all.find((s) => s.type === "PERSONAL" && s.ownerId === user.id) ?? null
      : null;
  const starredSpaces = all.filter((s) => starredIds.includes(s.id));
  const spaces: SpaceWithPages[] = personalSpace
    ? [
        personalSpace,
        ...starredSpaces.filter((s) => s.id !== personalSpace.id),
      ]
    : starredSpaces;

  const togglePersonalSpace = useMutation<void, Error>({
    mutationFn: async () => {
      const r = await apiFetch("/api/auth/me/prefs", {
        method: "PATCH",
        body: JSON.stringify({
          showPersonalSpaceInSidebar: !user?.showPersonalSpaceInSidebar,
        }),
      });
      if (!r.ok) throw new Error("설정 저장 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
    onError: (err) => window.alert(err.message),
  });

  const enterSpace = (sp: SpaceWithPages) => {
    // Cycle 32 — 공간의 홈(메인) 페이지로 진입.
    const homeId = getSpaceHomePageId(sp);
    router.push(homeId ? `/?pageId=${homeId}` : `/?spaceId=${sp.id}`);
  };

  // ── 접힌 모드 — 아이콘 전용 (56px) ─────────────────────────────────────
  if (collapsed) {
    const allItems = [...DISCOVER_ITEMS, ...MYWORK_ITEMS];
    return (
      <aside className="w-14 shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] h-full overflow-y-auto flex flex-col items-center py-3 gap-1 pb-12">
        {allItems.map((item) => {
          const active = currentView === item.id;
          return (
            <Link
              key={item.id}
              href={`/home?view=${item.id}`}
              title={item.label}
              aria-label={item.label}
              className={`w-9 h-9 flex items-center justify-center rounded ${
                active
                  ? "bg-[#deebff] text-[#0052cc]"
                  : "text-[#42526e] hover:bg-[#ebecf0]"
              }`}
            >
              <ViewIcon id={item.id} />
            </Link>
          );
        })}

        {spaces.length > 0 && (
          <div className="w-8 border-t border-[#dfe1e6] my-1.5" />
        )}

        {spaces.map((sp) => (
          <button
            key={sp.id}
            type="button"
            onClick={() => enterSpace(sp)}
            title={sp.name}
            aria-label={sp.name}
            className="w-9 h-9 flex items-center justify-center rounded hover:bg-[#ebecf0]"
          >
            <SpaceAvatar name={sp.name} icon={sp.icon} size={24} />
          </button>
        ))}
      </aside>
    );
  }

  // ── 펼친 모드 — 라벨 포함 (260px) ──────────────────────────────────────
  return (
    <aside className="w-[260px] shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] h-full overflow-y-auto flex flex-col">
      {/* 발견 */}
      <SectionHeader>발견</SectionHeader>
      <div className="px-2 space-y-0.5">
        {DISCOVER_ITEMS.map((s) => (
          <SubItemLink key={s.id} view={s.id} active={currentView === s.id}>
            {s.label}
          </SubItemLink>
        ))}
      </div>

      {/* 내 작업 */}
      <SectionHeader>내 작업</SectionHeader>
      <div className="px-2 space-y-0.5">
        {MYWORK_ITEMS.map((s) => (
          <SubItemLink key={s.id} view={s.id} active={currentView === s.id}>
            {s.label}
          </SubItemLink>
        ))}
      </div>

      {/* 내 공간 — 별표한 스페이스 (+ Cycle 49 토글 ON 시 본인 personal space) */}
      <div className="px-4 pt-4 pb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
          내 공간
        </span>
        {user && (
          <button
            type="button"
            onClick={() => togglePersonalSpace.mutate()}
            disabled={togglePersonalSpace.isPending}
            title={
              user.showPersonalSpaceInSidebar
                ? "내 개인 공간 숨기기"
                : "내 개인 공간 추가"
            }
            className="text-[10px] text-[#6b778c] hover:text-[#172b4d] disabled:opacity-50"
          >
            {user.showPersonalSpaceInSidebar ? "개인 공간 ✓" : "+ 내 공간 추가"}
          </button>
        )}
      </div>
      <div className="px-2 pb-4 space-y-0.5">
        {spaces.length === 0 ? (
          <div className="pl-7 pr-3 py-1.5 text-[12px] text-[#6b778c]">
            별표한 공간이 없습니다. 상단 공간 메뉴에서 ☆을 눌러 추가하세요.
          </div>
        ) : (
          spaces.map((sp) => (
            <div key={sp.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => enterSpace(sp)}
                title={sp.description ?? sp.name}
                className="flex-1 flex items-center gap-2 pl-4 pr-1 py-1.5 rounded text-[13px] text-left text-[#172b4d] hover:bg-[#ebecf0]"
              >
                <SpaceAvatar name={sp.name} icon={sp.icon} size={20} />
                <span className="flex-1 truncate">{sp.name}</span>
              </button>
              <SpaceStarButton spaceId={sp.id} size="sm" className="mr-2" />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
