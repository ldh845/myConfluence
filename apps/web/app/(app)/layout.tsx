"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import SystemSidebar from "@/components/SystemSidebar";
import TrashSheet from "@/components/TrashSheet";
import { useRecentPagesStore } from "@/lib/stores/useRecentPagesStore";
import { getSpaceHomePageId } from "@/lib/spaceHome";
import type { PageFull, SpaceWithPages } from "@/lib/types";

// Cycle 28 — TopNav + Sidebar 영속 셸.
// route group "(app)"으로 묶인 모든 페이지가 이 layout 안에서 렌더된다.
// /login, /share/[token]은 (app) 밖이라 셸이 없다. (Cycle 43: /signup 제거)
// spaces/space-selection/trash 상태는 셸이 보유 — 라우트 전환에도 그대로 유지된다.

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [trashOpen, setTrashOpen] = useState(false);

  const { data: spacesData } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });
  const spaces = spacesData ?? [];

  useEffect(() => {
    if (!selectedSpaceId && spaces[0]) setSelectedSpaceId(spaces[0].id);
  }, [spaces, selectedSpaceId]);

  // Cycle 29 (bugfix) — activeSpace를 URL 기준으로 도출한다.
  // 사용자가 /home에서 "내 공간"의 다른 카드(빈 스페이스 포함)를 클릭하면
  // URL이 /?spaceId=X 또는 /?pageId=Y로 바뀌는데, selectedSpaceId state는
  // TopNav combobox로만 갱신되므로 사이드바 컨텍스트가 어긋난다.
  // URL 우선: spaceId > pageId로 역방향 lookup > selectedSpaceId state > 첫 스페이스.
  const pageIdParam =
    pathname === "/" ? searchParams.get("pageId") : null;
  const spaceIdParam =
    pathname === "/" ? searchParams.get("spaceId") : null;

  const activeSpace = useMemo<SpaceWithPages | null>(() => {
    if (spaceIdParam) {
      const sp = spaces.find((s) => s.id === spaceIdParam);
      if (sp) return sp;
    }
    if (pageIdParam) {
      const sp = spaces.find((s) =>
        s.pages.some((p) => p.id === pageIdParam),
      );
      if (sp) return sp;
    }
    return spaces.find((s) => s.id === selectedSpaceId) ?? spaces[0] ?? null;
  }, [spaces, selectedSpaceId, pageIdParam, spaceIdParam]);

  // 사이드바 트리에서 어떤 페이지가 활성으로 표시되어야 하는지.
  // / 라우트에서만 URL의 ?pageId를 따라가고, /home·/activity·/search에선 null.
  const selectedPageId = pageIdParam;

  const invalidateSpaces = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["spaces"] });
  }, [queryClient]);

  const handleSelectSpace = (id: string) => {
    setSelectedSpaceId(id);
    const space = spaces.find((s) => s.id === id);
    // Cycle 32 — 공간 진입 시 그 공간의 홈(메인) 페이지로.
    const homeId = getSpaceHomePageId(space);
    if (homeId) router.push(`/?pageId=${homeId}`);
    else router.push(`/?spaceId=${id}`);
  };

  const handleCreateSpace = async () => {
    const name = prompt("새 공간 이름:");
    if (!name) return;
    const description = prompt("공간 설명 (선택):") || null;
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      alert("공간 생성 실패");
      return;
    }
    const created = (await res.json()) as { id: string };
    invalidateSpaces();
    setSelectedSpaceId(created.id);
    router.push("/");
  };

  const handleCreatePage = async (
    spaceId: string,
    parentId: string | null,
  ) => {
    const title = prompt("새 페이지 제목:");
    if (!title) return;
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title, content: "", spaceId, parentId }),
    });
    if (!res.ok) {
      if (res.status === 401) alert("로그인이 필요합니다.");
      else alert("페이지 생성 실패");
      return;
    }
    const page = (await res.json()) as PageFull;
    invalidateSpaces();
    router.push(`/?pageId=${page.id}`);
  };

  // Cycle 56 — cascade 옵션 + 라우팅 fix (같은 공간 유지, 부모/홈으로 이동).
  //   사용자 보고: 삭제 후 router.push('/') 가 첫 스페이스 fallback 으로 가
  //   '다른 공간으로 들어가지는' 버그. 현재 activeSpace 의 페이지 트리에서
  //   부모 → 홈 → 빈 공간 진입 순으로 fallback.
  const handleDeletePage = async (pageId: string, cascade: boolean) => {
    // 삭제 전에 부모/홈을 미리 결정 (삭제 후엔 activeSpace 캐시가 갱신되어 사라짐).
    const pageInTree = activeSpace?.pages.find((p) => p.id === pageId);
    const parentId = pageInTree?.parentId ?? null;
    const homeId = getSpaceHomePageId(activeSpace);
    const url = `/api/pages/${pageId}${cascade ? "?cascade=true" : ""}`;
    const res = await fetch(url, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      if (selectedPageId === pageId) {
        if (parentId) {
          router.push(`/?pageId=${parentId}`);
        } else if (homeId && homeId !== pageId) {
          router.push(`/?pageId=${homeId}`);
        } else if (activeSpace) {
          router.push(`/?spaceId=${activeSpace.id}`);
        } else {
          router.push("/");
        }
      }
      // FR-130 — 휴지통 이동 시 최근 방문 기록에서도 제거.
      useRecentPagesStore.getState().remove(pageId);
      invalidateSpaces();
    } else if (res.status === 401) {
      alert("로그인이 필요합니다.");
    }
  };

  const handleSelectPage = (id: string) => {
    router.push(`/?pageId=${id}`);
  };

  // Cycle 29 — /spaces(공간 검색)는 사이드바 없는 전체 폭 페이지.
  const isFullWidth = pathname === "/spaces";

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
      <TopNav
        spaces={spaces}
        activeSpaceId={activeSpace?.id ?? null}
        onSelectSpace={handleSelectSpace}
        onCreateSpace={handleCreateSpace}
      />
      {isFullWidth ? (
        <main className="flex-1 min-w-0 overflow-auto bg-white">
          {children}
        </main>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Cycle 29 — 시스템 홈(/home)은 SystemSidebar, 스페이스 뷰는 Sidebar.
              시스템 홈은 접어도 아이콘 전용 미니 사이드바를 유지한다. */}
          {pathname === "/home" ? (
            <div className="relative shrink-0">
              <SystemSidebar collapsed={!sidebarOpen} />
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                title={sidebarOpen ? "사이드바 접기" : "사이드바 펴기"}
                aria-label={sidebarOpen ? "사이드바 접기" : "사이드바 펴기"}
                className="absolute bottom-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded text-[16px] font-bold leading-none text-[#172b4d] hover:bg-[#ebecf0] hover:text-[#0052cc]"
              >
                {sidebarOpen ? "«" : "»"}
              </button>
            </div>
          ) : sidebarOpen ? (
            <div className="relative shrink-0">
              <Sidebar
                space={activeSpace}
                selectedPageId={selectedPageId}
                onSelect={handleSelectPage}
                onCreatePage={handleCreatePage}
                onDeletePage={handleDeletePage}
                onOpenTrash={() => setTrashOpen(true)}
                onReorder={invalidateSpaces}
              />
              <button
                onClick={() => setSidebarOpen(false)}
                title="사이드바 접기"
                aria-label="사이드바 접기"
                className="absolute bottom-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded text-[16px] font-bold leading-none text-[#172b4d] hover:bg-[#ebecf0] hover:text-[#0052cc]"
              >
                «
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              title="사이드바 펴기"
              aria-label="사이드바 펴기"
              className="w-6 shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] flex items-end justify-center pb-3 text-[16px] font-bold text-[#172b4d] hover:bg-[#ebecf0] hover:text-[#0052cc]"
            >
              »
            </button>
          )}

          <main className="flex-1 min-w-0 overflow-auto bg-white">
            {children}
          </main>
        </div>
      )}

      <TrashSheet
        open={trashOpen}
        onOpenChange={setTrashOpen}
        onRestored={invalidateSpaces}
      />
    </div>
  );
}

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // useSearchParams는 Suspense를 요구. 셸 자체를 Suspense로 감싼다.
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-white" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
