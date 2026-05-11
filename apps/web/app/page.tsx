"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
// SRS 5.9 검색·AI 사이클에서 재구현 예정 (Cycle 2-5 일시 비활성)
// import ChatPanel from "@/components/ChatPanel";
import PageHeader from "@/components/PageHeader";
import WelcomeBanner from "@/components/WelcomeBanner";
import DiagramList from "@/components/DiagramList";
import AttachmentList from "@/components/AttachmentList";
import TableOfContents from "@/components/TableOfContents";
import PageVersionHistory from "@/components/PageVersionHistory";
import QuickSearchDialog from "@/components/QuickSearchDialog";
import PageComments from "@/components/PageComments";
import { getIdentity } from "@/lib/userIdentity";
import { usePageStore } from "@/lib/stores/usePageStore";
import type {
  PresenceUser,
  SaveStatus,
} from "@/components/CollaborativeEditor";
import type { PageFull, SpaceWithPages } from "@/lib/types";
import type { Editor } from "@tiptap/react";

const CollaborativeEditor = dynamic(
  () => import("@/components/CollaborativeEditor"),
  { ssr: false }
);

export default function HomePage() {
  // Cycle 11-2 — selectedPageId의 진실은 URL의 ?pageId=<id>. useState 대신
  // useSearchParams로 직접 읽고, 페이지 선택은 router.push로 URL을 바꾼다.
  // 빈 URL이거나 잘못된 id는 활성 스페이스의 첫 페이지로 fallback.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pageIdFromUrl = searchParams.get("pageId");

  const [spaces, setSpaces] = useState<SpaceWithPages[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<PageFull | null>(null);
  // SRS 5.9 검색·AI 사이클에서 재구현 예정 (Cycle 2-5 일시 비활성)
  // const [chatOpen, setChatOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [isBodyEditable, setIsBodyEditable] = useState(false);
  // FR-039 — TableOfContents에 editor 참조를 넘기기 위한 상태.
  const [editor, setEditor] = useState<Editor | null>(null);
  // FR-061 — 버전 히스토리 슬라이드 패널 토글.
  const [historyOpen, setHistoryOpen] = useState(false);
  // FR-093 (Cycle 15-1b) — Ctrl/Cmd+K 빠른 검색 popup 토글.
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);

  const loadSpaces = useCallback(async () => {
    const res = await fetch("/api/spaces");
    const data: SpaceWithPages[] = await res.json();
    setSpaces(data);
    setSelectedSpaceId((prev) => prev ?? data[0]?.id ?? null);
  }, []);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  // URL에 pageId가 없을 때의 fallback — 활성 스페이스의 첫 페이지.
  const defaultPageId = useMemo<string | null>(() => {
    const space =
      spaces.find((s) => s.id === selectedSpaceId) ?? spaces[0] ?? null;
    return space?.pages[0]?.id ?? null;
  }, [spaces, selectedSpaceId]);

  const selectedPageId = pageIdFromUrl ?? defaultPageId;

  // 페이지 선택 — URL을 바꾸면 derived selectedPageId가 따라간다.
  const selectPage = useCallback(
    (id: string) => {
      router.push(`${pathname}?pageId=${id}`);
    },
    [router, pathname],
  );

  const clearPageSelection = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  const queryClient = useQueryClient();

  const loadCurrentPage = useCallback(async (pageId: string) => {
    const r = await fetch(`/api/pages/${pageId}`);
    const p = r.ok ? ((await r.json()) as PageFull) : null;
    setCurrentPage(p);
  }, []);

  useEffect(() => {
    setIsBodyEditable(false);
    if (!selectedPageId) {
      setCurrentPage(null);
      return;
    }
    setSaveStatus("idle");
    loadCurrentPage(selectedPageId);
  }, [selectedPageId, loadCurrentPage]);

  // Cycle 10-2b-2 — TaskItemNodeView가 조회 모드에서 즉시 발행할 때 쓰는
  // pageId/authorName을 store에 동기화. NodeView는 props를 못 받으므로 store
  // 우회.
  useEffect(() => {
    if (currentPage) {
      usePageStore.getState().setPage(currentPage.id, getIdentity().name);
    } else {
      usePageStore.getState().reset();
    }
  }, [currentPage]);

  // FR-093 (Cycle 15-1b) — Ctrl+K / Cmd+K 글로벌 단축키.
  // 본문 편집 중에도 동작해야 하므로 window 레벨에서 listen.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Cycle 11-2 / FR-034 — 본문 안의 내부 페이지 링크(/?pageId=<id>)를
  // 가로채 SPA 라우팅으로 전환. 같은 origin + 같은 경로 + pageId 쿼리가
  // 있을 때만 가로채고, 외부 URL / 다른 경로 / modifier 클릭(새 탭 등)은
  // 그대로 둔다.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname !== window.location.pathname) return;
        const newPageId = url.searchParams.get("pageId");
        if (!newPageId) return;
        e.preventDefault();
        router.push(`${pathname}?pageId=${newPageId}`);
      } catch {
        // 잘못된 URL은 default 동작 그대로.
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [router, pathname]);

  // Cycle 10-2a — 발행 흐름. draftContent → content + PageVersion 스냅샷.
  const publish = useMutation({
    mutationFn: async (pageId: string) => {
      const r = await fetch(`/api/pages/${pageId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ authorName: getIdentity().name }),
      });
      if (!r.ok) {
        if (r.status === 400) throw new Error("발행할 변경 사항이 없습니다.");
        throw new Error("발행에 실패했습니다.");
      }
      return (await r.json()) as PageFull;
    },
    onSuccess: async (_data, pageId) => {
      window.alert("발행되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["page-versions", pageId] });
      await loadCurrentPage(pageId);
    },
    onError: (err: Error) => {
      window.alert(err.message);
    },
  });

  const handlePublish = useCallback(() => {
    if (!currentPage) return;
    publish.mutate(currentPage.id);
  }, [currentPage, publish]);

  const enterEditMode = useCallback(() => {
    setIsBodyEditable(true);
    // Focus the body editor shortly after the editable flag flips so the
    // caret lands inside ProseMirror.
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(".ProseMirror");
      el?.focus({ preventScroll: true });
    });
  }, []);

  const exitEditMode = useCallback(() => {
    // Effect cleanup inside CollaborativeEditor force-flushes any pending
    // debounced save when `editable` flips to false, so we just flip state.
    setIsBodyEditable(false);
  }, []);

  const toggleEditMode = useCallback(() => {
    if (isBodyEditable) exitEditMode();
    else enterEditMode();
  }, [isBodyEditable, enterEditMode, exitEditMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!currentPage) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const inInput =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const inBody = !!t?.isContentEditable;

      if ((e.key === "e" || e.key === "E") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // E toggles edit mode unless the user is typing somewhere.
        if (inInput || inBody) return;
        e.preventDefault();
        toggleEditMode();
        return;
      }

      if (e.key === "Escape") {
        // Esc exits edit mode only when focus is inside the body editor.
        if (inBody && isBodyEditable) {
          e.preventDefault();
          (t as HTMLElement | null)?.blur?.();
          exitEditMode();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPage, isBodyEditable, toggleEditMode, exitEditMode]);

  const activeSpace = useMemo<SpaceWithPages | null>(
    () => spaces.find((s) => s.id === selectedSpaceId) ?? spaces[0] ?? null,
    [spaces, selectedSpaceId]
  );

  const isFirstPageOfSpace = useMemo(() => {
    if (!currentPage || !activeSpace) return false;
    const firstRoot = activeSpace.pages
      .filter((p) => !p.parentId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1))[0];
    return firstRoot?.id === currentPage.id;
  }, [currentPage, activeSpace]);

  const handleSelectSpace = (id: string) => {
    setSelectedSpaceId(id);
    const space = spaces.find((s) => s.id === id);
    const first = space?.pages[0]?.id;
    if (first) selectPage(first);
    else clearPageSelection();
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
    const created = await res.json();
    await loadSpaces();
    setSelectedSpaceId(created.id);
    clearPageSelection();
  };

  const handleCreatePage = async (
    spaceId: string,
    parentId: string | null
  ) => {
    const title = prompt("새 페이지 제목:");
    if (!title) return;
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: "", spaceId, parentId }),
    });
    if (res.ok) {
      const page: PageFull = await res.json();
      await loadSpaces();
      selectPage(page.id);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    const res = await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedPageId === pageId) clearPageSelection();
      await loadSpaces();
    }
  };

  const handleTitleChange = async (title: string) => {
    if (!currentPage) return;
    setSaveStatus("saving");
    const res = await fetch(`/api/pages/${currentPage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const updated = (await res.json()) as PageFull;
      setCurrentPage(updated);
      setSaveStatus("saved");
      loadSpaces();
    } else {
      setSaveStatus("error");
    }
  };

  const confirmDeleteCurrent = () => {
    if (!currentPage) return;
    if (
      confirm(
        `"${currentPage.title}" 페이지를 삭제할까요? 하위 페이지도 함께 삭제됩니다.`
      )
    )
      handleDeletePage(currentPage.id);
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
            onSelect={selectPage}
            onCreatePage={handleCreatePage}
            onDeletePage={handleDeletePage}
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
          <div className="max-w-[960px] mx-auto px-10 pt-8 pb-16">
            {sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="mb-2 text-[12px] text-[#6b778c] hover:text-[#0052cc]"
              >
                ‹ 사이드바 접기
              </button>
            )}

            {!currentPage ? (
              <div className="mt-24 text-center text-[#6b778c]">
                왼쪽에서 페이지를 선택하거나 새 페이지를 만드세요.
              </div>
            ) : (
              <>
                {isFirstPageOfSpace && activeSpace && (
                  <WelcomeBanner spaceName={activeSpace.name} />
                )}
                <PageHeader
                  page={currentPage}
                  space={activeSpace}
                  saveStatus={saveStatus}
                  presence={presence}
                  isBodyEditable={isBodyEditable}
                  onToggleEdit={toggleEditMode}
                  onTitleChange={handleTitleChange}
                  onDelete={confirmDeleteCurrent}
                  onSelectAncestor={selectPage}
                  onHistoryClick={() => setHistoryOpen(true)}
                  hasDraft={currentPage.draftContent !== null}
                  publishing={publish.isPending}
                  onPublish={handlePublish}
                />
                <hr className="my-4 border-[#dfe1e6]" />
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-8">
                  <div className="min-w-0">
                    <CollaborativeEditor
                      key={`${currentPage.id}-${
                        isBodyEditable ? "edit" : "view"
                      }`}
                      pageId={currentPage.id}
                      initialMarkdown={
                        isBodyEditable
                          ? currentPage.draftContent ?? currentPage.content
                          : currentPage.content
                      }
                      editable={isBodyEditable}
                      onSaveStatusChange={setSaveStatus}
                      onPresenceChange={setPresence}
                      onEditor={setEditor}
                    />
                    <DiagramList
                      pageId={currentPage.id}
                      editable={isBodyEditable}
                    />
                    <AttachmentList
                      pageId={currentPage.id}
                      editable={isBodyEditable}
                    />
                    <PageComments
                      pageId={currentPage.id}
                      editable={isBodyEditable}
                    />
                  </div>
                  <aside className="hidden lg:block sticky top-4 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto pl-4 border-l border-[#dfe1e6]">
                    <TableOfContents editor={editor} />
                  </aside>
                </div>
                <div className="mt-10 flex items-center justify-between border-t border-[#dfe1e6] pt-4">
                  <div className="flex items-center gap-2 text-[13px] text-[#6b778c]">
                    <button className="hover:text-[#0052cc]">👍</button>
                    <span>처음으로 좋아하는 사람이 돼볼까요?</span>
                  </div>
                  <div className="text-[13px] text-[#6b778c]">
                    🏷️ 레이블 없음
                  </div>
                </div>

                <div className="mt-6 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0052cc] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                    U
                  </div>
                  <input
                    placeholder="댓글 작성..."
                    disabled
                    className="flex-1 px-3 py-2 text-sm bg-[#f4f5f7] border border-[#dfe1e6] rounded cursor-not-allowed"
                  />
                </div>
              </>
            )}
          </div>
        </main>

        {/* SRS 5.9 검색·AI 사이클에서 재구현 예정 (Cycle 2-5 일시 비활성)
        <ChatPanel
          open={chatOpen}
          onToggle={() => setChatOpen((v) => !v)}
          onOpenPage={setSelectedPageId}
        />
        */}
      </div>
      <PageVersionHistory
        pageId={selectedPageId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <QuickSearchDialog
        open={quickSearchOpen}
        onOpenChange={setQuickSearchOpen}
        onSelect={selectPage}
      />
    </div>
  );
}
