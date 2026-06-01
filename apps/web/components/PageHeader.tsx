"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PageFull, PageNode, SpaceWithPages } from "@/lib/types";
import type {
  ConnectionState,
  PresenceUser,
  SaveStatus,
} from "@/components/CollaborativeEditor";
import { downloadPageMarkdown } from "@/lib/export/markdown";
import { openPrintDialog } from "@/lib/export/print";
import { useAuth } from "@/lib/auth/useAuth";
import AppIcon from "@/components/AppIcon";
import PageStatusDropdown from "@/components/PageStatusDropdown";
import RestrictButton from "@/components/RestrictButton";

function relativeTime(iso: string): string {
  const diffSec = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  );
  if (diffSec < 60) return `${diffSec}초 전`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.round(hr / 24);
  return `${day}일 전`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function buildBreadcrumb(
  page: PageFull,
  pages: PageNode[]
): { id: string; title: string }[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const chain: { id: string; title: string }[] = [];
  let cursor: PageNode | undefined = byId.get(page.id);
  while (cursor) {
    chain.unshift({ id: cursor.id, title: cursor.title });
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return chain;
}

type Props = {
  page: PageFull;
  space: SpaceWithPages | null;
  saveStatus: SaveStatus;
  presence: PresenceUser[];
  connectionState?: ConnectionState;
  isBodyEditable: boolean;
  onToggleEdit: () => void;
  onTitleChange: (title: string) => void;
  onDelete: () => void;
  onSelectAncestor: (id: string) => void;
  onHistoryClick?: () => void;
  hasDraft?: boolean;
  publishing?: boolean;
  onPublish?: () => void;
  onMoveClick?: () => void;
  onCopyClick?: () => void;
  onShareClick?: () => void;
  // Cycle 53 — 인라인 댓글 사이드/하단 표시 토글 (V 단축키).
};

export default function PageHeader({
  page,
  space,
  saveStatus,
  presence,
  connectionState,
  isBodyEditable,
  onToggleEdit,
  onTitleChange,
  onDelete,
  onSelectAncestor,
  onHistoryClick,
  hasDraft,
  publishing,
  onPublish,
  onMoveClick,
  onCopyClick,
  onShareClick,
}: Props) {
  const crumbs = space ? buildBreadcrumb(page, space.pages) : [];
  const ancestors = crumbs.slice(0, -1);
  const [draft, setDraft] = useState(page.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  // Cycle 70 — 상태 변경 권한(임시 가드: 작성자 또는 ADMIN). 백엔드가 최종 검증.
  const canEditStatus =
    !!user && (user.role === "ADMIN" || page.author?.id === user.id);
  const queryClient = useQueryClient();

  // Cycle 53 — '나중을 위해 저장' 상태. 로그인 사용자만 의미가 있다.
  //   key 에 user.id 포함 — 다른 사용자로 갈아끼면 자동 분리.
  const savedQuery = useQuery<{ saved: boolean }>({
    queryKey: ["save", page.id, user?.id ?? null],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${page.id}/save`, {
        credentials: "include",
      });
      if (!r.ok) return { saved: false };
      return (await r.json()) as { saved: boolean };
    },
    enabled: !!user,
    staleTime: 30_000,
  });
  const isSaved = savedQuery.data?.saved ?? false;

  const saveMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const r = await fetch(`/api/pages/${page.id}/save`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("save toggle failed");
      return (await r.json()) as { saved: boolean };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["save", page.id, user?.id ?? null],
        data,
      );
      // 홈 '나중을 위해 저장' 목록이 즉시 반영되도록 무효화.
      queryClient.invalidateQueries({ queryKey: ["my-saves"] });
    },
  });
  const toggleSaved = () => {
    if (!user || saveMutation.isPending) return;
    saveMutation.mutate(!isSaved);
  };

  // Cycle 53 — '지켜보기' 상태. 구조는 saved 와 동일.
  const watchQuery = useQuery<{ watching: boolean }>({
    queryKey: ["watch", page.id, user?.id ?? null],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${page.id}/watch`, {
        credentials: "include",
      });
      if (!r.ok) return { watching: false };
      return (await r.json()) as { watching: boolean };
    },
    enabled: !!user,
    staleTime: 30_000,
  });
  const isWatching = watchQuery.data?.watching ?? false;

  const watchMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const r = await fetch(`/api/pages/${page.id}/watch`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("watch toggle failed");
      return (await r.json()) as { watching: boolean };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["watch", page.id, user?.id ?? null],
        data,
      );
    },
  });
  const toggleWatching = () => {
    if (!user || watchMutation.isPending) return;
    watchMutation.mutate(!isWatching);
  };

  useEffect(() => {
    setDraft(page.title);
  }, [page.id, page.title]);

  // When edit mode turns on, pre-select the title for quick rename.
  useEffect(() => {
    if (isBodyEditable) {
      setDraft(page.title);
      requestAnimationFrame(() => {
        inputRef.current?.select();
      });
    }
  }, [isBodyEditable, page.title]);

  // Cycle 53 — 단축키 V/F/W/S. 조회 모드 전용(편집 모드는 FullScreenEditor 가
  //   PageHeader 대신 전체 화면을 차지하므로 PageHeader 가 마운트조차 안 됨 →
  //   자연 가드). 입력 포커스(INPUT/TEXTAREA/SELECT/contentEditable) 시 skip.
  //   E 단축키는 (app)/page.tsx 가 양쪽 모드에서 처리(편집 진입/이탈 토글).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        !!t?.isContentEditable
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      switch (key) {
        case "f":
          e.preventDefault();
          toggleSaved();
          break;
        // Cycle 61 followup — 지켜보기 비활성화(개발 중). W 단축키 무동작.
        // toggleWatching 코드/알림 인프라는 유지 (재활성화 시 한 줄 복구).
        // case "w": e.preventDefault(); toggleWatching(); break;
        case "s":
          if (onShareClick) {
            e.preventDefault();
            onShareClick();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSaved, toggleWatching, onShareClick]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== page.title) {
      onTitleChange(next);
    } else {
      setDraft(page.title);
    }
    // Stay in edit mode; blur the input so further keys don't trap here.
    inputRef.current?.blur();
  };

  const cancel = () => {
    setDraft(page.title);
    inputRef.current?.blur();
  };

  const notLoggedInTitle = "로그인이 필요합니다";

  return (
    <div className="mb-4">
      {/* FR-054 (Cycle 26) — 오프라인 안내 배너. */}
      {connectionState === "offline" && (
        <div className="mb-3 px-3 py-2 bg-[#fff7d6] border border-[#f5cd47] rounded-md text-[12px] text-[#7f5f01]">
          ⚠️ 네트워크가 끊어졌습니다. 편집 내용은 로컬에 저장되며, 재연결 시
          자동으로 동기화됩니다.
        </div>
      )}
      {/* Cycle 81 — 브레드크럼 줄: 좌측 브레드크럼 + 제한 버튼, 우측 정렬 액션. */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <nav className="min-w-0 overflow-hidden text-[12px] text-[#6b778c] flex items-center gap-1 whitespace-nowrap">
            {space && <span className="shrink-0">{space.name}</span>}
            {ancestors.map((c) => (
              <span key={c.id} className="flex items-center gap-1 shrink-0">
                <span>/</span>
                <button
                  onClick={() => onSelectAncestor(c.id)}
                  className="hover:text-[#0052cc] hover:underline"
                >
                  {c.title}
                </button>
              </span>
            ))}
            <span className="shrink-0">/</span>
            <span className="text-[#172b4d] font-medium truncate">
              {page.title}
            </span>
          </nav>
          <RestrictButton pageId={page.id} />
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <PresenceStrip users={presence} />
          <SaveStatusBadge status={saveStatus} />
          {/* FR-054 (Cycle 26) — 연결 상태 뱃지 (정상은 무소음). */}
          <ConnectionBadge state={connectionState} />
          {isBodyEditable && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#deebff] text-[#0052cc] text-[11px] font-semibold">
              ● 편집 중
            </span>
          )}
          {/* (1) 편집 — 양쪽 모드에서 노출. 단축키 E. */}
          <button
            onClick={onToggleEdit}
            title={isBodyEditable ? "편집 종료 (E)" : "편집 (E)"}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] ${
              isBodyEditable
                ? "bg-[#0052cc] text-white hover:bg-[#0747a6]"
                : "text-[#42526e] hover:bg-[#ebecf0]"
            }`}
          >
            {isBodyEditable ? (
              <span>✓</span>
            ) : (
              <AppIcon name="edit" size={14} alt="편집" />
            )}
            <span>{isBodyEditable ? "완료 (E)" : "편집 (E)"}</span>
          </button>
          {isBodyEditable && (
            <button
              type="button"
              onClick={onPublish}
              disabled={!hasDraft || publishing}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] bg-[#36b37e] text-white hover:bg-[#2a8c61] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
              title={
                hasDraft
                  ? "임시 저장된 변경 사항을 발행합니다"
                  : "발행할 변경 사항이 없습니다"
              }
            >
              <span>🚀</span>
              <span>{publishing ? "발행 중..." : "발행"}</span>
            </button>
          )}
          {/* Cycle 53 — 조회 모드 전용 메인 액션 4개 + ⋯. */}
          {!isBodyEditable && (
            <>
              {/* (3) 나중을 위해 저장 (F) — SavedPage 토글 */}
              <ActionButton
                icon={
                  <AppIcon
                    name={isSaved ? "star" : "starOutline"}
                    size={14}
                    alt="나중을 위해 저장"
                  />
                }
                label="나중을 위해 저장"
                tooltip={user ? `나중을 위해 저장 (F)` : notLoggedInTitle}
                disabled={!user || saveMutation.isPending}
                onClick={toggleSaved}
              />
              {/* (4) 지켜보기 — Cycle 61 followup: 개발 중이라 비활성화.
                  WatchList 토글 + 알림 인프라(Cycle 53/61)는 코드로 유지,
                  재활성화 시 disabled/onClick/단축키만 복구. */}
              <ActionButton
                icon={<AppIcon name="watch" size={14} alt="지켜보기" />}
                label="지켜보기"
                tooltip="지켜보기 — 아직 개발 중인 기능입니다"
                disabled
              />
              {/* (5) 공유 (S) — SharePageDialog */}
              <ActionButton
                icon={<AppIcon name="share" size={14} alt="공유" />}
                label="공유"
                tooltip={`공유 (S)`}
                onClick={onShareClick}
              />
            </>
          )}
          {/* (6) ⋯ 더보기 — 이동/복사/히스토리/내보내기/공간 홈/삭제 */}
          <MoreMenu
            page={page}
            space={space}
            onDelete={onDelete}
            onMoveClick={onMoveClick}
            onCopyClick={onCopyClick}
            onHistoryClick={onHistoryClick}
          />
        </div>
      </div>

      {/* 제목 줄 — 액션은 위 브레드크럼 줄로 이동(Cycle 81). */}
      <div className="mt-3 flex items-start gap-4">
        {isBodyEditable ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            placeholder="페이지 제목을 입력하세요"
            className="flex-1 text-[32px] leading-tight font-bold text-[#172b4d] bg-white outline-none border-2 border-[#0052cc] rounded px-2 py-1 ring-2 ring-[#deebff]"
          />
        ) : (
          <div className="flex-1 min-w-0 flex items-center gap-2 py-1 px-0.5">
            <h1 className="text-[32px] leading-tight font-bold text-[#172b4d] min-w-0">
              {page.title}
            </h1>
            {/* Cycle 70 — 제목 옆 작업 상태 배지 + 변경 드롭다운. */}
            <PageStatusDropdown
              pageId={page.id}
              status={page.status}
              canEdit={canEditStatus}
            />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 text-[12px] text-[#6b778c]">
        <div className="w-5 h-5 rounded-full bg-[#0052cc] text-white flex items-center justify-center text-[10px] font-semibold">
          {page.author?.name?.slice(0, 1).toUpperCase() ?? "U"}
        </div>
        <span>
          작성자: {page.author?.name ?? "알 수 없음"}
          {page.author?.department && (
            <span className="text-[#a5adba] ml-1">
              ({page.author.department})
            </span>
          )}
        </span>
        <span>|</span>
        <span>
          최근 수정: {formatDateTime(page.updatedAt)}
          {page.lastEditor?.name && (
            <span className="text-[#a5adba] ml-1">
              ({page.lastEditor.name})
            </span>
          )}
        </span>
        <span>|</span>
        <span>{relativeTime(page.updatedAt)}</span>
        {isBodyEditable && (
          <>
            <span>|</span>
            <span className="text-[#0052cc]">
              편집 모드 — 제목은 Enter로 저장, Esc로 취소 · 본문은 자동 저장
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function PresenceStrip({ users }: { users: PresenceUser[] }) {
  if (!users.length) return null;
  const visible = users.slice(0, 5);
  const rest = users.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((u) => (
        <div
          key={u.clientId}
          title={u.self ? `${u.name} (나)` : u.name}
          className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-semibold text-white shadow-sm"
          style={{ background: u.color }}
        >
          {u.name.slice(0, 1)}
        </div>
      ))}
      {rest > 0 && (
        <div className="w-6 h-6 rounded-full border-2 border-white bg-[#6b778c] text-white text-[10px] font-semibold flex items-center justify-center">
          +{rest}
        </div>
      )}
    </div>
  );
}

// FR-054 (Cycle 26) — 연결 상태 뱃지. online-synced는 침묵.
function ConnectionBadge({ state }: { state?: ConnectionState }) {
  if (!state || state === "online-synced") return null;
  const map: Record<
    Exclude<ConnectionState, "online-synced">,
    { text: string; cls: string }
  > = {
    "online-syncing": {
      text: "🔄 동기화 중",
      cls: "bg-[#deebff] text-[#0052cc]",
    },
    offline: {
      text: "🔴 오프라인 — 로컬 저장됨",
      cls: "bg-[#ffebe6] text-[#bf2600]",
    },
    reconnecting: {
      text: "🟡 재연결 중...",
      cls: "bg-[#fff7d6] text-[#7f5f01]",
    },
  };
  const m = map[state];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${m.cls}`}
    >
      {m.text}
    </span>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  const { text, cls } = (() => {
    switch (status) {
      case "saving":
        return { text: "저장 중...", cls: "text-[#6b778c]" };
      case "saved":
        return { text: "저장됨", cls: "text-[#006644]" };
      case "error":
        return { text: "저장 실패", cls: "text-[#de350b]" };
      default:
        return { text: "", cls: "" };
    }
  })();
  if (!text) return null;
  return <span className={`text-[12px] ${cls}`}>{text}</span>;
}

// Cycle 53 — active(채워진 상태) / tooltip(단축키 노출) 옵션 추가.
//   active 시 파란색 배경(deebff) + 진한 파란 글자(0052cc) 로 상태 표시.
function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  active,
  tooltip,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  tooltip?: string;
}) {
  const base = "inline-flex items-center gap-1 px-2 py-1 rounded text-[12px]";
  const cls = disabled
    ? `${base} text-[#a5adba] cursor-not-allowed`
    : active
      ? `${base} bg-[#deebff] text-[#0052cc] font-semibold hover:bg-[#b3d4ff]`
      : `${base} text-[#42526e] hover:bg-[#ebecf0]`;
  return (
    <button onClick={onClick} disabled={disabled} title={tooltip} className={cls}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// Cycle 53 — MoreMenu 재구성:
//   추가: 이동 / 복사 / 히스토리 (상단에서 옮김)
//   제거: 공유 링크 (메인 '공유 (S)' 와 중복)
//   유지: Markdown / PDF 내보내기 / 공간 홈 / 페이지 삭제
function MoreMenu({
  page,
  space,
  onDelete,
  onMoveClick,
  onCopyClick,
  onHistoryClick,
}: {
  page: PageFull;
  space: SpaceWithPages | null;
  onDelete: () => void;
  onMoveClick?: () => void;
  onCopyClick?: () => void;
  onHistoryClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  // Cycle 33 — 현재 페이지가 이미 이 공간의 홈인지.
  const isSpaceHome = !!space && space.homePageId === page.id;

  // Cycle 33 — 이 페이지를 공간 홈으로 지정.
  const setAsSpaceHome = async () => {
    setOpen(false);
    const res = await fetch(`/api/spaces/${page.spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ homePageId: page.id }),
    });
    if (res.status === 401) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!res.ok) {
      alert("공간 홈 지정에 실패했습니다.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["spaces"] });
    alert("이 페이지를 공간 홈으로 지정했습니다.");
  };

  const itemCls =
    "w-full text-left px-3 py-1.5 text-[#172b4d] hover:bg-[#ebecf0]";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-7 h-7 rounded text-[#42526e] hover:bg-[#ebecf0]"
        aria-label="더 보기"
      >
        ⋯
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-48 bg-white border border-[#dfe1e6] rounded shadow-lg z-20 py-1 text-sm">
            {/* Cycle 53 — 상단에서 옮긴 액션 3개 */}
            {onMoveClick && (
              <button
                className={itemCls}
                onClick={() => {
                  setOpen(false);
                  onMoveClick();
                }}
              >
                ↗ 이동
              </button>
            )}
            {onCopyClick && (
              <button
                className={itemCls}
                onClick={() => {
                  setOpen(false);
                  onCopyClick();
                }}
              >
                ⧉ 복사
              </button>
            )}
            {onHistoryClick && (
              <button
                className={itemCls}
                onClick={() => {
                  setOpen(false);
                  onHistoryClick();
                }}
              >
                🕘 히스토리
              </button>
            )}
            <div className="my-1 border-t border-[#dfe1e6]" />
            {/* FR-121 (Cycle 21) — 내보내기 메뉴. */}
            <button
              className={itemCls}
              onClick={() => {
                setOpen(false);
                void downloadPageMarkdown({
                  id: page.id,
                  title: page.title,
                  content: page.content,
                });
              }}
            >
              <span className="inline-flex items-center gap-2">
                <AppIcon name="page" size={14} alt="" />
                Markdown으로 내보내기
              </span>
            </button>
            <button
              className={itemCls}
              onClick={() => {
                setOpen(false);
                openPrintDialog();
              }}
            >
              🖨️ PDF로 내보내기
            </button>
            <div className="my-1 border-t border-[#dfe1e6]" />
            {/* Cycle 33 — 공간 홈 페이지 지정. */}
            {isSpaceHome ? (
              <div className="w-full text-left px-3 py-1.5 text-[#6b778c] cursor-default">
                ✓ 공간 홈
              </div>
            ) : (
              <button className={itemCls} onClick={setAsSpaceHome}>
                <span className="inline-flex items-center gap-2">
                  <AppIcon name="home" size={14} alt="" />
                  공간 홈으로 지정
                </span>
              </button>
            )}
            <div className="my-1 border-t border-[#dfe1e6]" />
            <button
              className="w-full text-left px-3 py-1.5 text-[#de350b] hover:bg-[#ffebe6]"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <span className="inline-flex items-center gap-2">
                <AppIcon name="trash" size={14} alt="" />
                페이지 삭제
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
