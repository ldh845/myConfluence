"use client";

import { useEffect, useRef, useState } from "react";
import type { PageFull, PageNode, SpaceWithPages } from "@/lib/types";
import type {
  ConnectionState,
  PresenceUser,
  SaveStatus,
} from "@/components/CollaborativeEditor";
import { useFavoritesStore } from "@/lib/stores/useFavoritesStore";
import { downloadPageMarkdown } from "@/lib/export/markdown";
import { openPrintDialog } from "@/lib/export/print";

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

  // FR-025 (Cycle 18-2) — 즐겨찾기 토글. localStorage persist.
  const isFavorite = useFavoritesStore((s) => s.ids.includes(page.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

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

  return (
    <div className="mb-4">
      {/* FR-054 (Cycle 26) — 오프라인 안내 배너. */}
      {connectionState === "offline" && (
        <div className="mb-3 px-3 py-2 bg-[#fff7d6] border border-[#f5cd47] rounded-md text-[12px] text-[#7f5f01]">
          ⚠️ 네트워크가 끊어졌습니다. 편집 내용은 로컬에 저장되며, 재연결 시
          자동으로 동기화됩니다.
        </div>
      )}
      <nav className="text-[12px] text-[#6b778c] flex flex-wrap items-center gap-1">
        {space && <span>{space.name}</span>}
        {ancestors.map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <span>/</span>
            <button
              onClick={() => onSelectAncestor(c.id)}
              className="hover:text-[#0052cc] hover:underline"
            >
              {c.title}
            </button>
          </span>
        ))}
        <span>/</span>
        <span className="text-[#172b4d] font-medium">{page.title}</span>
      </nav>

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
          <h1 className="flex-1 text-[32px] leading-tight font-bold text-[#172b4d] py-1 px-0.5">
            {page.title}
          </h1>
        )}
        <div className="flex items-center gap-2 pt-3 shrink-0">
          <PresenceStrip users={presence} />
          <SaveStatusBadge status={saveStatus} />
          {/* FR-054 (Cycle 26) — 연결 상태 뱃지 (정상은 무소음). */}
          <ConnectionBadge state={connectionState} />
          {isBodyEditable && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#deebff] text-[#0052cc] text-[11px] font-semibold">
              ● 편집 중
            </span>
          )}
          <button
            onClick={onToggleEdit}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] ${
              isBodyEditable
                ? "bg-[#0052cc] text-white hover:bg-[#0747a6]"
                : "text-[#42526e] hover:bg-[#ebecf0]"
            }`}
          >
            <span>{isBodyEditable ? "✓" : "✏️"}</span>
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
          <ActionButton icon="💬" label="댓글" disabled />
          {/* FR-025 (Cycle 18-2) — ⭐ 즐겨찾기. 채워진 별은 활성. */}
          <ActionButton
            icon={isFavorite ? "⭐" : "☆"}
            label="즐겨찾기"
            onClick={() => toggleFavorite(page.id)}
          />
          {/* FR-022 (Cycle 18-3b) — 페이지 이동 다이얼로그 열기. */}
          <ActionButton icon="↗" label="이동" onClick={onMoveClick} />
          {/* FR-023 (Cycle 18-4b) — 페이지 복사 다이얼로그 열기. */}
          <ActionButton icon="⧉" label="복사" onClick={onCopyClick} />
          <ActionButton icon="👁️" label="지켜보기" disabled />
          <ActionButton icon="🔗" label="공유" disabled />
          <ActionButton
            icon="🕘"
            label="히스토리"
            onClick={onHistoryClick}
          />
          <MoreMenu
            page={page}
            onDelete={onDelete}
            onShareClick={onShareClick}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[12px] text-[#6b778c]">
        <div className="w-5 h-5 rounded-full bg-[#0052cc] text-white flex items-center justify-center text-[10px] font-semibold">
          U
        </div>
        <span>작성자: Unknown</span>
        <span>|</span>
        <span>최근 수정: {formatDateTime(page.updatedAt)}</span>
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

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] ${
        disabled
          ? "text-[#a5adba] cursor-not-allowed"
          : "text-[#42526e] hover:bg-[#ebecf0]"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function MoreMenu({
  page,
  onDelete,
  onShareClick,
}: {
  page: PageFull;
  onDelete: () => void;
  onShareClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
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
            {/* FR-121 (Cycle 21) — 내보내기 메뉴. */}
            <button
              className="w-full text-left px-3 py-1.5 text-[#172b4d] hover:bg-[#ebecf0]"
              onClick={() => {
                setOpen(false);
                void downloadPageMarkdown({
                  id: page.id,
                  title: page.title,
                  content: page.content,
                });
              }}
            >
              📄 Markdown으로 내보내기
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-[#172b4d] hover:bg-[#ebecf0]"
              onClick={() => {
                setOpen(false);
                openPrintDialog();
              }}
            >
              🖨️ PDF로 내보내기
            </button>
            {/* FR-120 (Cycle 23) — 공유 링크 다이얼로그. */}
            <button
              className="w-full text-left px-3 py-1.5 text-[#172b4d] hover:bg-[#ebecf0]"
              onClick={() => {
                setOpen(false);
                onShareClick?.();
              }}
            >
              🔗 공유 링크
            </button>
            <div className="my-1 border-t border-[#dfe1e6]" />
            <button
              className="w-full text-left px-3 py-1.5 text-[#de350b] hover:bg-[#ffebe6]"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              페이지 삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}
