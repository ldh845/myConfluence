"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import TrashSheet from "@/components/TrashSheet";
import { useRecentPagesStore } from "@/lib/stores/useRecentPagesStore";
import type { PageFull, SpaceWithPages } from "@/lib/types";

// Cycle 28 — TopNav + Sidebar 영속 셸.
// route group "(app)"으로 묶인 모든 페이지가 이 layout 안에서 렌더된다.
// /login, /signup, /share/[token]은 (app) 밖이라 셸이 없다.
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

  const activeSpace = useMemo<SpaceWithPages | null>(
    () => spaces.find((s) => s.id === selectedSpaceId) ?? spaces[0] ?? null,
    [spaces, selectedSpaceId],
  );

  // 사이드바 트리에서 어떤 페이지가 활성으로 표시되어야 하는지.
  // / 라우트에서만 URL의 ?pageId를 따라가고, /home·/activity·/search에선 null.
  const selectedPageId =
    pathname === "/" ? searchParams.get("pageId") : null;

  const invalidateSpaces = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["spaces"] });
  }, [queryClient]);

  const handleSelectSpace = (id: string) => {
    setSelectedSpaceId(id);
    const space = spaces.find((s) => s.id === id);
    const first = space?.pages[0]?.id;
    if (first) router.push(`/?pageId=${first}`);
    else router.push("/");
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

  const handleDeletePage = async (pageId: string) => {
    const res = await fetch(`/api/pages/${pageId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      if (selectedPageId === pageId) router.push("/");
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
      <TopNav
        spaces={spaces}
        activeSpaceId={activeSpace?.id ?? null}
        onSelectSpace={handleSelectSpace}
        onCreateSpace={handleCreateSpace}
      />
      <div className="flex flex-1 min-h-0">
        {sidebarOpen ? (
          <Sidebar
            space={activeSpace}
            selectedPageId={selectedPageId}
            onSelect={handleSelectPage}
            onCreatePage={handleCreatePage}
            onDeletePage={handleDeletePage}
            onOpenTrash={() => setTrashOpen(true)}
            onReorder={invalidateSpaces}
          />
        ) : (
          <button
            onClick={() => setSidebarOpen(true)}
            title="사이드바 열기"
            className="w-6 shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] flex items-start justify-center pt-3 text-[#6b778c] hover:bg-[#ebecf0]"
          >
            ›
          </button>
        )}

        <main className="flex-1 min-w-0 overflow-auto bg-white">
          {sidebarOpen && (
            <div className="max-w-[960px] mx-auto px-10 pt-3">
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-[12px] text-[#6b778c] hover:text-[#0052cc]"
              >
                ‹ 사이드바 접기
              </button>
            </div>
          )}
          {children}
        </main>
      </div>

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
