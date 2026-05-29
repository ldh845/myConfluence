"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// SRS 5.9 검색·AI 사이클에서 재구현 예정 (Cycle 2-5 일시 비활성)
// import ChatPanel from "@/components/ChatPanel";
import PageHeader from "@/components/PageHeader";
import FullScreenEditor from "@/components/FullScreenEditor";
import SpacePagesView from "@/components/SpacePagesView";
import KanbanBoard from "@/components/KanbanBoard";
import SpaceSettings from "@/components/SpaceSettings";
import ProfileView from "@/components/ProfileView";
import MentionEditPopover from "@/components/MentionEditPopover";
import TableOfContents from "@/components/TableOfContents";
import PageVersionHistory from "@/components/PageVersionHistory";
import PageComments from "@/components/PageComments";
import { useAuth } from "@/lib/auth/useAuth";
import MovePageDialog from "@/components/MovePageDialog";
import CopyPageDialog from "@/components/CopyPageDialog";
import SharePageDialog from "@/components/SharePageDialog";
import DeletePageDialog from "@/components/DeletePageDialog";
import ReactionBar from "@/components/ReactionBar";
import { useIdentity } from "@/lib/useIdentity";
import { usePageStore } from "@/lib/stores/usePageStore";
import { useRecentPagesStore } from "@/lib/stores/useRecentPagesStore";
import { useRecentSpacesStore } from "@/lib/stores/useRecentSpacesStore";
import { getSpaceHomePageId } from "@/lib/spaceHome";
import type {
  ConnectionState,
  PresenceUser,
  SaveStatus,
} from "@/components/CollaborativeEditor";
import type { PageFull, SpaceWithPages } from "@/lib/types";
import type { Editor } from "@tiptap/react";

const CollaborativeEditor = dynamic(
  () => import("@/components/CollaborativeEditor"),
  { ssr: false }
);

// Cycle 28 — TopNav + Sidebar는 (app)/layout.tsx의 셸이 마운트한다.
// 이 라우트는 main 안의 페이지 본문만 책임진다.
// spaces는 ["spaces"] queryKey로 layout과 동일 캐시 공유.

export default function HomePage() {
  // Cycle 11-2 — selectedPageId의 진실은 URL의 ?pageId=<id>.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Fix — 댓글 작성은 본문 편집 모드와 무관하게 로그인 사용자면 가능.
  const { user } = useAuth();
  const pageIdFromUrl = searchParams.get("pageId");
  // Cycle 29 — SystemSidebar의 "내 공간" 카드는 /?spaceId=X로 진입한다.
  // pageId가 없으면 그 스페이스의 첫 페이지로 자동 이동.
  const spaceIdFromUrl = searchParams.get("spaceId");
  // Cycle 51 — 스페이스 사이드바 "페이지" 메뉴는 /?spaceId=X&view=pages 로
  // 진입한다. 그 경우엔 첫 페이지 자동 이동 없이 SpacePagesView(최근 업데이트
  // 목록)를 그린다. 현재 값은 'pages' 만 지원.
  const view = searchParams.get("view");
  const isPagesListView = view === "pages" && !!spaceIdFromUrl;
  // Cycle 71 — /?spaceId=X&view=board 칸반 보드. view=pages 와 동일하게 페이지
  //   본문 fetch 없이 보드만 렌더(아래 가드들에 함께 포함).
  const isBoardView = view === "board" && !!spaceIdFromUrl;
  // Cycle 74-B — /?spaceId=X&view=settings 공간 도구. 동일하게 본문 fetch 없이 렌더.
  const isSettingsView = view === "settings" && !!spaceIdFromUrl;
  // Cycle 58 — /?profileId=X 진입 시 사용자 프로파일 화면 (정보 + 활동 피드).
  //   멘션 토큰 클릭의 라우팅 타겟. 같은 (app)/page.tsx 안에서 view 분기로 처리.
  const profileIdFromUrl = searchParams.get("profileId");
  const isProfileView = !!profileIdFromUrl;

  const queryClient = useQueryClient();
  const identity = useIdentity();

  const { data: spacesData } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });
  const spaces = spacesData ?? [];

  const invalidateSpaces = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["spaces"] });
  }, [queryClient]);

  const [currentPage, setCurrentPage] = useState<PageFull | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  // FR-054 (Cycle 26) — 협업 연결 상태(헤더 뱃지/배너용).
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("online-synced");
  const [isBodyEditable, setIsBodyEditable] = useState(false);
  // FR-039 — TableOfContents에 editor 참조를 넘기기 위한 상태.
  const [editor, setEditor] = useState<Editor | null>(null);
  // FR-061 — 버전 히스토리 슬라이드 패널 토글.
  const [historyOpen, setHistoryOpen] = useState(false);
  // FR-022 (Cycle 18-3b) — 이동 다이얼로그 토글.
  const [moveOpen, setMoveOpen] = useState(false);
  // FR-023 (Cycle 18-4b) — 복사 다이얼로그 토글.
  const [copyOpen, setCopyOpen] = useState(false);
  // FR-120 (Cycle 23) — 공유 다이얼로그 토글.
  const [shareOpen, setShareOpen] = useState(false);
  // Cycle 53 — 본문 아래 인라인 댓글 리스트 표시 토글 (V 단축키 / 헤더 버튼).
  //   default true: 기존 동작(항상 표시) 유지 — 회귀 없음.
  // Cycle 58 — 편집 모드에서 멘션 토큰 클릭 시 컨텍스트 팝업.
  const [mentionPopover, setMentionPopover] = useState<
    | {
        x: number;
        y: number;
        userId: string;
        label: string;
        element: HTMLElement;
      }
    | null
  >(null);
  // Cycle 10-2a 보강 — currentPage.draftContent 는 페이지 로드 시점 스냅샷이라
  // 자동저장 후엔 stale. 자동저장이 성공하면(saveStatus="saved") draft가
  // 존재한다고 보고 발행 버튼을 활성화한다. currentPage가 다시 로드되면
  // (페이지 전환 / 발행 직후) 서버 값 기준으로 재설정.
  const [hasDraft, setHasDraft] = useState(false);

  // URL에 pageId가 없을 때의 fallback.
  // spaceId가 지정됐고 그 스페이스에 페이지가 있으면 첫 페이지로.
  // spaceId 지정됐는데 빈 스페이스면 null (UI에서 빈 상태 안내) — 다른 스페이스로
  // 자동 폴백하지 않는다. 그래야 빈 스페이스 카드를 클릭한 의도가 무시되지 않는다.
  // 어떤 spaceId도 없을 때만 첫 스페이스의 첫 페이지로 폴백.
  // Cycle 32 — 공간 진입 시 그 공간의 홈(메인) 페이지를 연다.
  const defaultPageId = useMemo<string | null>(() => {
    if (spaceIdFromUrl) {
      const sp = spaces.find((s) => s.id === spaceIdFromUrl);
      return getSpaceHomePageId(sp);
    }
    return getSpaceHomePageId(spaces[0]);
  }, [spaces, spaceIdFromUrl]);

  // Cycle 51 — view=pages 면 페이지 본문/편집기를 마운트하지 않는다.
  // selectedPageId 를 null 로 두면 loadCurrentPage 가 호출되지 않고,
  // 최근 방문 기록 같은 부작용도 발화하지 않아 SpacePagesView 만 깔끔히 표시.
  // Cycle 58 — profileId 진입도 동일 (ProfileView 만 표시, 본문 fetch 차단).
  const selectedPageId =
    isPagesListView || isBoardView || isSettingsView || isProfileView
      ? null
      : (pageIdFromUrl ?? defaultPageId);

  // /?spaceId=X 로 진입한 경우 (페이지가 있을 때만) 첫 페이지 URL로 replace.
  // Cycle 51 — view=pages 진입 시엔 자동 replace 차단(URL 가드).
  // Cycle 58 — profileId 진입 시에도 동일.
  useEffect(() => {
    if (
      !pageIdFromUrl &&
      spaceIdFromUrl &&
      defaultPageId &&
      !isPagesListView &&
      !isBoardView &&
      !isSettingsView &&
      !isProfileView
    ) {
      router.replace(`/?pageId=${defaultPageId}`);
    }
  }, [
    pageIdFromUrl,
    spaceIdFromUrl,
    defaultPageId,
    router,
    isPagesListView,
    isBoardView,
    isSettingsView,
    isProfileView,
  ]);

  const selectPage = useCallback(
    (id: string) => {
      router.push(`${pathname}?pageId=${id}`);
    },
    [router, pathname],
  );

  const clearPageSelection = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  const loadCurrentPage = useCallback(async (pageId: string) => {
    const r = await fetch(`/api/pages/${pageId}`);
    const p = r.ok ? ((await r.json()) as PageFull) : null;
    setCurrentPage(p);
  }, []);

  useEffect(() => {
    // Cycle 36 follow-up — 편집 모드 초기값을 URL ?edit=1 에 동기적으로 맞춘다.
    // 이전엔 항상 false로 리셋한 뒤, currentPage 로드 완료 후 별도 useEffect
    // 에서 ?edit=1이면 true로 다시 올렸다. 이 사이 비동기 race로 TopNav 만들기
    // → 편집 창 자동 진입이 가끔 무산되어 사용자가 새 draft를 못 편집했다.
    // searchParams를 deps에 넣지 않는 건 의도적: edit=1 정리(router.replace)
    // 시 이 effect가 다시 돌면 isBodyEditable이 즉시 false로 떨어진다.
    setIsBodyEditable(searchParams.get("edit") === "1");
    // selectedPageId가 바뀔 땐 currentPage도 즉시 비운다. 그렇게 안 하면
    // loadCurrentPage 가 도착하기 전 1프레임 동안 stale한 이전 페이지가
    // FullScreenEditor에 그대로 박혀 "전혀 안 바뀐 듯한 깜빡임"으로 보인다.
    setCurrentPage(null);
    if (!selectedPageId) {
      return;
    }
    setSaveStatus("idle");
    loadCurrentPage(selectedPageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId, loadCurrentPage]);

  // Cycle 10-2b-2 — TaskItemNodeView가 조회 모드에서 즉시 발행할 때 쓰는
  // pageId/authorName을 store에 동기화.
  useEffect(() => {
    if (currentPage) {
      usePageStore.getState().setPage(currentPage.id, identity.name);
    } else {
      usePageStore.getState().reset();
    }
  }, [currentPage, identity.name]);

  // FR-130 (Cycle 22) — 최근 방문 기록.
  useEffect(() => {
    if (currentPage) {
      useRecentPagesStore.getState().record(currentPage.id);
    }
  }, [currentPage]);

  // currentPage가 다시 로드될 때(페이지 전환 / 발행 직후) 서버의 draftContent
  // 기준으로 hasDraft 재설정. loadCurrentPage가 매번 새 객체를 만들므로
  // currentPage 참조 변경으로 감지된다.
  useEffect(() => {
    setHasDraft(currentPage?.draftContent != null);
  }, [currentPage]);

  // 자동저장 성공 → draft 존재. (currentPage는 자동저장으로 갱신되지 않으므로
  // saveStatus 전이로 보강한다.)
  useEffect(() => {
    if (saveStatus === "saved") setHasDraft(true);
  }, [saveStatus]);

  // Cycle 29 — 최근 사용한 공간 기록. 페이지가 로드되면 그 페이지의 공간,
  // 빈 스페이스로 진입(/?spaceId=X)했으면 그 spaceId 를 기록.
  useEffect(() => {
    const spaceId = currentPage?.spaceId ?? spaceIdFromUrl;
    if (spaceId) {
      useRecentSpacesStore.getState().record(spaceId);
    }
  }, [currentPage, spaceIdFromUrl]);

  // Cycle 32 — ?edit=1 (TopNav "만들기"로 갓 생성된 페이지)이면 편집 모드로 진입.
  // 진입 직후 URL에서 edit 파라미터를 정리 — 새로고침 시 다시 편집모드로
  // 들어가지 않도록.
  // Cycle 36 follow-up — selectedPageId effect가 isBodyEditable=true를 동기적
  // 으로 먼저 잡지만, 같은 pageId에서 ?edit=1만 추가되는 케이스(예: URL 직접
  // 입력)도 살리기 위해 여기서 한 번 더 보강한다. URL 정리(replace)는 currentPage
  // 로드 완료 후에 — 그래야 새로고침 시 자동 편집 모드로 다시 안 들어간다.
  // 결정적 보강: currentPage.id === URL pageId 체크 추가. 안 그러면 만들기 직후
  // 같은 라우트 navigation에서 currentPage가 STALE한 이전 페이지인 채로 effect가
  // 발화해 router.replace(이전pageId)로 URL이 즉시 회귀, "아무것도 안 떠" 증상의
  // 근본 원인이 된다.
  useEffect(() => {
    const urlPageId = searchParams.get("pageId");
    if (
      currentPage &&
      currentPage.id === urlPageId &&
      searchParams.get("edit") === "1"
    ) {
      setIsBodyEditable(true);
      router.replace(`/?pageId=${currentPage.id}`);
    }
  }, [currentPage, searchParams, router]);

  // Cycle 31 — Ctrl/Cmd+K 글로벌 단축키는 TopNav 의 SearchOverlay 로 이관됨.

  // Cycle 11-2 / FR-034 — 본문 안의 내부 페이지 링크(/?pageId=<id>)를 SPA로.
  // Cycle 55 followup — .cf-mention 클릭 → 해당 사용자의 개인 공간으로 이동
  //   (Cycle 49 personal space 활용). data-id 는 멘션 노드 attrs.id.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;

      // 멘션 클릭 분기 — link 핸들러보다 먼저 (멘션이 a 안에 들어갈 일 없음).
      // Cycle 58 — 조회 모드: /?profileId=X (사용자 프로파일).
      //   편집 모드: 컨텍스트 popover (연결로 이동/편집/연결해제).
      const mention = target?.closest?.(".cf-mention") as HTMLElement | null;
      if (mention) {
        const userId = mention.getAttribute("data-id") ?? "";
        if (!userId) return;
        e.preventDefault();
        if (isBodyEditable) {
          const rect = mention.getBoundingClientRect();
          // 노드 텍스트 '@홍길동' 에서 label 추출
          const label = (mention.textContent ?? "").replace(/^@/, "");
          setMentionPopover({
            x: rect.left,
            y: rect.bottom + 2,
            userId,
            label,
            element: mention,
          });
        } else {
          router.push(`${pathname}?profileId=${userId}`);
        }
        return;
      }

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
    // Cycle 55 followup — spaces 가 deps 에 들어가야 멘션 클릭이 최신 캐시
    // 기반으로 동작. Cycle 58 — isBodyEditable 분기로 편집 모드 popover 처리.
  }, [router, pathname, spaces, isBodyEditable]);

  // Cycle 10-2a — 발행 흐름.
  // Cycle 34 — note 동반(선택), 성공 시 편집 모드 탈출(버그 수정 핵심).
  // Cycle 36 — content를 클라이언트가 직접 보낸다. 자동저장 5초 debounce에
  // 의존하던 "두 번 발행해야 보이는" 버그를 차단. 성공 시 alert 제거.
  const publish = useMutation({
    mutationFn: async (vars: {
      pageId: string;
      content?: string;
      note?: string;
    }) => {
      const r = await fetch(`/api/pages/${vars.pageId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          authorName: identity.name,
          // content는 빈 문자열 ""도 명시 발행으로 인정해야 하므로
          // !== undefined로 분기. note는 빈 문자열이면 보내지 않는다.
          ...(vars.content !== undefined ? { content: vars.content } : {}),
          ...(vars.note ? { note: vars.note } : {}),
        }),
      });
      if (!r.ok) {
        if (r.status === 400) throw new Error("발행할 변경 사항이 없습니다.");
        throw new Error("발행에 실패했습니다.");
      }
      return (await r.json()) as PageFull;
    },
    onSuccess: async (_data, vars) => {
      // Cycle 36 — "발행되었습니다" alert 제거. 조용히 조회 모드로 전환.
      queryClient.invalidateQueries({
        queryKey: ["page-versions", vars.pageId],
      });
      // Cycle 35 — 첫 발행이면 publishedAt이 채워져 사이드바 트리에 등장해야
      // 하므로 spaces 캐시를 함께 갱신. 재발행 시에도 page.updatedAt 등이
      // 바뀌어 트리 정렬이 최신화된다.
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      await loadCurrentPage(vars.pageId);
      // Cycle 34 — 발행 후 편집 모드 탈출. 이전엔 editable이 그대로라 편집
      // 화면에 머무르며 자동저장이 또 발화돼 hasDraft가 즉시 살아났다.
      setIsBodyEditable(false);
    },
    onError: (err: Error) => {
      // 실패 시엔 사용자에게 알린다.
      window.alert(err.message);
    },
  });

  const handlePublish = useCallback(
    (content?: string, note?: string) => {
      if (!currentPage) return;
      publish.mutate({ pageId: currentPage.id, content, note });
    },
    [currentPage, publish],
  );

  const enterEditMode = useCallback(() => {
    setIsBodyEditable(true);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(".ProseMirror");
      el?.focus({ preventScroll: true });
    });
  }, []);

  const exitEditMode = useCallback(() => {
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
        if (inInput || inBody) return;
        e.preventDefault();
        toggleEditMode();
        return;
      }

      if (e.key === "Escape") {
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

  // PageHeader breadcrumb / WelcomeBanner / CopyPageDialog가 참조하는 활성 스페이스.
  // 우선순위: URL의 spaceId > currentPage.spaceId > 첫 스페이스.
  // 빈 스페이스(/?spaceId=Y, currentPage=null)에서도 사용자가 클릭한 그 스페이스를 표시한다.
  const activeSpace = useMemo<SpaceWithPages | null>(
    () => {
      if (spaceIdFromUrl) {
        const sp = spaces.find((s) => s.id === spaceIdFromUrl);
        if (sp) return sp;
      }
      return (
        spaces.find((s) => s.id === currentPage?.spaceId) ?? spaces[0] ?? null
      );
    },
    [spaces, currentPage, spaceIdFromUrl],
  );

  // Cycle 34 — FullScreenEditor breadcrumb. 현재 페이지를 제외한 조상 체인.
  // PageHeader.buildBreadcrumb과 같은 BFS-up 로직(페이지 트리에서 parentId를 따라 올라감).
  const ancestors = useMemo<{ id: string; title: string }[]>(() => {
    if (!currentPage || !activeSpace) return [];
    const byId = new Map(activeSpace.pages.map((p) => [p.id, p]));
    const chain: { id: string; title: string }[] = [];
    let cursor = byId.get(currentPage.id);
    // 자기 자신은 제외하고 부모부터 위로 올라가며 누적.
    cursor = cursor?.parentId ? byId.get(cursor.parentId) : undefined;
    while (cursor) {
      chain.unshift({ id: cursor.id, title: cursor.title });
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return chain;
  }, [currentPage, activeSpace]);

  const handleTitleChange = async (title: string) => {
    if (!currentPage) return;
    setSaveStatus("saving");
    const res = await fetch(`/api/pages/${currentPage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const updated = (await res.json()) as PageFull;
      setCurrentPage(updated);
      setSaveStatus("saved");
      invalidateSpaces();
    } else {
      setSaveStatus("error");
    }
  };

  // Cycle 56 — cascade 옵션 + 같은 공간 유지 라우팅 (부모/홈 fallback).
  const handleDeleteCurrentPage = async (
    pageId: string,
    cascade: boolean,
  ) => {
    // 삭제 전에 부모/홈 미리 결정 (삭제 후 activeSpace 캐시 갱신되면 사라짐).
    const pageInTree = activeSpace?.pages.find((p) => p.id === pageId);
    const parentId = pageInTree?.parentId ?? null;
    const homeId = activeSpace
      ? getSpaceHomePageId(activeSpace)
      : null;
    const url = `/api/pages/${pageId}${cascade ? "?cascade=true" : ""}`;
    const res = await fetch(url, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      if (selectedPageId === pageId) {
        if (parentId) {
          router.push(`${pathname}?pageId=${parentId}`);
        } else if (homeId && homeId !== pageId) {
          router.push(`${pathname}?pageId=${homeId}`);
        } else if (activeSpace) {
          router.push(`${pathname}?spaceId=${activeSpace.id}`);
        } else {
          clearPageSelection();
        }
      }
      useRecentPagesStore.getState().remove(pageId);
      invalidateSpaces();
    } else if (res.status === 401) {
      window.alert("로그인이 필요합니다.");
    }
  };

  // Cycle 56 — window.confirm → DeletePageDialog. 자식 카운트 + cascade 체크박스.
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const currentChildCount = useMemo(() => {
    if (!currentPage || !activeSpace) return 0;
    return activeSpace.pages.filter(
      (p) => p.parentId === currentPage.id,
    ).length;
  }, [currentPage, activeSpace]);
  const confirmDeleteCurrent = () => {
    if (!currentPage) return;
    setDeleteDialogOpen(true);
  };

  // Cycle 51 — view=pages 면 페이지 본문/편집기 트리 전체를 건너뛰고
  // SpacePagesView 만 렌더. 위쪽 useEffect 들은 모두 실행되지만 selectedPageId
  // 가 null 이라 페이지 본문 fetch / 최근 방문 기록 등 부작용은 발생하지 않음.
  if (isPagesListView && spaceIdFromUrl) {
    return (
      <SpacePagesView
        spaceId={spaceIdFromUrl}
        spaceName={activeSpace?.name}
      />
    );
  }

  // Cycle 71 — 칸반 보드 뷰.
  if (isBoardView && spaceIdFromUrl) {
    return (
      <KanbanBoard spaceId={spaceIdFromUrl} spaceName={activeSpace?.name} />
    );
  }

  // Cycle 74-B — 공간 도구(설정) 뷰.
  if (isSettingsView && spaceIdFromUrl) {
    return <SpaceSettings spaceId={spaceIdFromUrl} />;
  }

  // Cycle 58 — profileId 진입 시 ProfileView 만 렌더 (사이드바는 직전 컨텍스트
  //   유지). 동일하게 selectedPageId null 가드로 본문 fetch 차단.
  if (isProfileView && profileIdFromUrl) {
    return <ProfileView userId={profileIdFromUrl} />;
  }

  // Cycle 36 follow-up — 편집 모드로 들어왔지만 새 페이지가 아직 로딩 중인
  // transition. 그냥 두면 view 모드 빈 상태("왼쪽에서 페이지를 선택...")가
  // 잠깐 보여 사용자가 "안 됐다"고 인식하는 원인이 된다. 동일한 fixed
  // 영역에 명시적인 로딩 자리를 깔아서 깜빡임 없이 곧장 편집기로 전환되게.
  if (isBodyEditable && selectedPageId && !currentPage) {
    return (
      <div className="fixed left-0 right-0 bottom-0 top-14 z-40 bg-white flex items-center justify-center text-[#6b778c] text-sm">
        편집기 준비 중...
      </div>
    );
  }

  // Cycle 34 — 편집 모드는 TopNav/사이드바를 덮는 전체 화면 편집기로 분기.
  // 인라인 PageHeader+에디터+다이어그램+첨부+댓글은 조회 모드 전용. 두 트리를
  // 동시에 마운트하지 않아 Yjs 세션이 한 번만 열린다.
  if (currentPage && isBodyEditable) {
    return (
      <FullScreenEditor
        page={currentPage}
        space={activeSpace}
        ancestors={ancestors}
        saveStatus={saveStatus}
        onTitleChange={handleTitleChange}
        onPublish={handlePublish}
        onClose={exitEditMode}
        publishing={publish.isPending}
        hasDraft={hasDraft}
        onSaveStatusChange={setSaveStatus}
        onConnectionStateChange={setConnectionState}
        onPresenceChange={setPresence}
      />
    );
  }

  return (
    <>
      {/* Cycle 52 — 조회 모드 본문 폭 제약 제거(max-w-[960px] mx-auto 폐기).
          편집 모드(FullScreenEditor, Cycle 38 followup `eb30e3d`)와 동일한
          반응형 좌우 패딩만 남겨 사이드바·TopNav 사이의 main 영역을 가로로
          꽉 채운다. 모드 전환 시 폭 jump 없음. */}
      <div className="px-8 lg:px-12 xl:px-16 pt-2 pb-16">
        {!currentPage ? (
          // 빈 스페이스로 진입한 경우 그 스페이스 이름을 안내.
          spaceIdFromUrl && activeSpace && activeSpace.pages.length === 0 ? (
            <div className="mt-24 text-center text-[#6b778c]">
              <div className="text-[16px] font-semibold text-[#172b4d] mb-1">
                {activeSpace.name} 공간에 페이지가 아직 없습니다
              </div>
              <div className="text-[13px]">
                왼쪽 사이드바의 &lsquo;＋ 새 페이지&rsquo;로 첫 페이지를 만들어보세요.
              </div>
            </div>
          ) : (
            <div className="mt-24 text-center text-[#6b778c]">
              왼쪽에서 페이지를 선택하거나 새 페이지를 만드세요.
            </div>
          )
        ) : (
          <>
            <PageHeader
              page={currentPage}
              space={activeSpace}
              saveStatus={saveStatus}
              presence={presence}
              connectionState={connectionState}
              isBodyEditable={isBodyEditable}
              onToggleEdit={toggleEditMode}
              onTitleChange={handleTitleChange}
              onDelete={confirmDeleteCurrent}
              onSelectAncestor={selectPage}
              onHistoryClick={() => setHistoryOpen(true)}
              hasDraft={hasDraft}
              publishing={publish.isPending}
              // Cycle 34/36 — 조회 모드의 PageHeader엔 발행 버튼이 노출되지 않지만,
              // handlePublish 시그니처(content?, note?)와 (): void 프롭 시그니처를
              // 안전하게 맞추기 위해 인자 없이 호출하는 래퍼로 감싼다.
              // 인자 없이 호출되면 백엔드는 기존처럼 서버 draftContent를 승격.
              onPublish={() => handlePublish()}
              onMoveClick={() => setMoveOpen(true)}
              onCopyClick={() => setCopyOpen(true)}
              onShareClick={() => setShareOpen(true)}
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
                  onConnectionStateChange={setConnectionState}
                />
                {/* Cycle 63 followup — 조회 화면에서 다이어그램/첨부파일 별도
                    섹션 제거(사용자 요청). 첨부·다이어그램은 본문에 삽입된
                    내용으로만 노출. */}
                {/* FR-073 (Cycle 25) — 페이지 이모지 반응 바. */}
                <ReactionBar target="page" targetId={currentPage.id} />
                {/* Cycle 77 — 좋아요 placeholder 제거(이모지 반응 바로 대체).
                    레이블 줄만 댓글 위에 유지. */}
                <div className="mt-10 flex items-center justify-end border-t border-[#dfe1e6] pt-4">
                  <div className="text-[13px] text-[#6b778c]">
                    🏷️ 레이블 없음
                  </div>
                </div>
                {/* Fix — 댓글은 조회 모드에서도 로그인 사용자면 작성 가능
                    (Confluence 표준). 기존 editable={isBodyEditable} 은 편집
                    모드에서만 작성 가능해 댓글 창이 비활성으로 보였음. */}
                <PageComments
                  pageId={currentPage.id}
                  editable={!!user}
                />
              </div>
              <aside className="hidden lg:block sticky top-4 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto pl-4 border-l border-[#dfe1e6]">
                <TableOfContents editor={editor} />
              </aside>
            </div>
            {/* Fix — 비활성 더미 '댓글 작성...' input 제거 (Cycle 16 이전
                placeholder). 실제 댓글 작성은 위 PageComments 가 담당. */}
          </>
        )}
      </div>

      <PageVersionHistory
        pageId={selectedPageId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      {currentPage && (
        <MovePageDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          page={{
            id: currentPage.id,
            title: currentPage.title,
            spaceId: currentPage.spaceId,
            parentId: currentPage.parentId,
          }}
          onMoved={async () => {
            invalidateSpaces();
            await loadCurrentPage(currentPage.id);
          }}
        />
      )}
      {currentPage && (
        <CopyPageDialog
          open={copyOpen}
          onOpenChange={setCopyOpen}
          page={{
            id: currentPage.id,
            title: currentPage.title,
            spaceId: currentPage.spaceId,
            parentId: currentPage.parentId,
          }}
          onCopied={async (newPage) => {
            invalidateSpaces();
            if (newPage.spaceId === activeSpace?.id) {
              selectPage(newPage.id);
            }
          }}
        />
      )}
      {currentPage && (
        <SharePageDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          page={{ id: currentPage.id, title: currentPage.title }}
        />
      )}
      {/* Cycle 56 — 페이지 삭제 다이얼로그 (자식 카운트 + cascade 체크박스). */}
      {currentPage && (
        <DeletePageDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          pageTitle={currentPage.title}
          childCount={currentChildCount}
          onConfirm={(cascade) =>
            handleDeleteCurrentPage(currentPage.id, cascade)
          }
        />
      )}

      {/* Cycle 58 — 편집 모드 멘션 클릭 컨텍스트 popover. */}
      {mentionPopover && (
        <MentionEditPopover
          x={mentionPopover.x}
          y={mentionPopover.y}
          userId={mentionPopover.userId}
          label={mentionPopover.label}
          onNavigate={() =>
            window.open(`/?profileId=${mentionPopover.userId}`, "_blank")
          }
          onEdit={() => {
            // 편집 = 멘션 노드 삭제 후 같은 위치에 '@' 텍스트 → suggestion
            //   자동 트리거 → 사용자가 새 멘션 선택.
            if (!editor) return;
            const pos = editor.view.posAtDOM(mentionPopover.element, 0);
            if (pos == null || pos < 0) return;
            editor
              .chain()
              .focus()
              .setNodeSelection(pos)
              .deleteSelection()
              .insertContent("@")
              .run();
          }}
          onUnlink={() => {
            if (!editor) return;
            const pos = editor.view.posAtDOM(mentionPopover.element, 0);
            if (pos == null || pos < 0) return;
            editor
              .chain()
              .focus()
              .setNodeSelection(pos)
              .deleteSelection()
              .run();
          }}
          onClose={() => setMentionPopover(null)}
        />
      )}
    </>
  );
}
