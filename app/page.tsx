"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
// SRS 5.9 검색·AI 사이클에서 재구현 예정 (Cycle 2-5 일시 비활성)
// import ChatPanel from "@/components/ChatPanel";
import PageHeader from "@/components/PageHeader";
import WelcomeBanner from "@/components/WelcomeBanner";
import DiagramList from "@/components/DiagramList";
import type {
  PresenceUser,
  SaveStatus,
} from "@/components/CollaborativeEditor";
import type { PageFull, SpaceWithPages } from "@/lib/types";

const CollaborativeEditor = dynamic(
  () => import("@/components/CollaborativeEditor"),
  { ssr: false }
);

export default function HomePage() {
  const [spaces, setSpaces] = useState<SpaceWithPages[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<PageFull | null>(null);
  // SRS 5.9 검색·AI 사이클에서 재구현 예정 (Cycle 2-5 일시 비활성)
  // const [chatOpen, setChatOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [isBodyEditable, setIsBodyEditable] = useState(false);

  const loadSpaces = useCallback(async () => {
    const res = await fetch("/api/spaces");
    const data: SpaceWithPages[] = await res.json();
    setSpaces(data);
    setSelectedSpaceId((prev) => prev ?? data[0]?.id ?? null);
    setSelectedPageId((prev) => prev ?? data[0]?.pages[0]?.id ?? null);
  }, []);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    setIsBodyEditable(false);
    if (!selectedPageId) {
      setCurrentPage(null);
      return;
    }
    fetch(`/api/pages/${selectedPageId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        setCurrentPage(p);
        setSaveStatus("idle");
      });
  }, [selectedPageId]);

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
    setSelectedPageId(space?.pages[0]?.id ?? null);
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
    setSelectedPageId(null);
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
      setSelectedPageId(page.id);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    const res = await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedPageId === pageId) setSelectedPageId(null);
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
            onSelect={setSelectedPageId}
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
                  onSelectAncestor={setSelectedPageId}
                />
                <hr className="my-4 border-[#dfe1e6]" />
                <CollaborativeEditor
                  key={currentPage.id}
                  pageId={currentPage.id}
                  initialMarkdown={currentPage.content}
                  editable={isBodyEditable}
                  onSaveStatusChange={setSaveStatus}
                  onPresenceChange={setPresence}
                />
                <DiagramList pageId={currentPage.id} editable={isBodyEditable} />
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
    </div>
  );
}
