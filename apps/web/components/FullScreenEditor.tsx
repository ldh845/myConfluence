"use client";

// Cycle 34 — Confluence "The Editor" 패턴.
// https://confluence.atlassian.com/doc/the-editor-251006017.html
//
// 인라인 PageHeader+에디터 대신, 편집 모드 진입 시 사이드바·본문 영역을 덮는
// 전체 화면 편집기를 띄운다. 조회 모드 ↔ 편집 모드 전환은 (app)/page.tsx의
// isBodyEditable 분기에서 일어난다.
//
// Cycle 35 — TopNav(h-14)는 가리지 않는다. fixed top-14로 그 아래부터 시작.
// 본문은 가운데 정렬 대신 좌측 기준 넓은 폭(콘텐츠는 오른쪽으로 넉넉히 흐름).
//
// 레이아웃 (위→아래):
//   [TopNav: layout이 그대로 렌더, h-14 고정]
//   1) 상단 툴바 (sticky)        — EditorToolbar (서식/삽입/실행취소·재실행)
//   2) breadcrumb + 페이지 도구  — 라벨/제한은 placeholder
//   3) 제목 input (큰 글씨)
//   4) 본문 (flex-1, 스크롤)     — CollaborativeEditor (hideToolbar)
//   5) 하단 바 (sticky)          — 단어 수 / 저장 상태 / 변경 코멘트 / 업데이트·닫기

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import EditorToolbar from "@/components/EditorToolbar";
import type {
  ConnectionState,
  PresenceUser,
  SaveStatus,
} from "@/components/CollaborativeEditor";
import type { PageFull, SpaceWithPages } from "@/lib/types";

// 본문 에디터는 SSR에서 제외 (Yjs/IndexedDB가 window 의존).
const CollaborativeEditor = dynamic(
  () => import("@/components/CollaborativeEditor"),
  { ssr: false },
);

type Props = {
  page: PageFull;
  space: SpaceWithPages | null;
  ancestors: { id: string; title: string }[];
  saveStatus: SaveStatus;
  onTitleChange: (title: string) => void;
  // Cycle 36 — 발행 시점에 편집기 현재 마크다운을 함께 전달. 자동저장(5초
  // debounce) 타이밍과 무관하게 클라이언트가 권위 있는 본문을 들고 있다.
  onPublish: (content: string, note: string) => void;
  onClose: () => void;
  publishing: boolean;
  hasDraft: boolean;
  onSaveStatusChange: (s: SaveStatus) => void;
  onConnectionStateChange?: (s: ConnectionState) => void;
  onPresenceChange?: (users: PresenceUser[]) => void;
};

export default function FullScreenEditor({
  page,
  space,
  ancestors,
  saveStatus,
  onTitleChange,
  onPublish,
  onClose,
  publishing,
  hasDraft,
  onSaveStatusChange,
  onConnectionStateChange,
  onPresenceChange,
}: Props) {
  // 편집기 인스턴스 — 툴바를 상단 sticky 영역에 분리 배치하기 위해
  // CollaborativeEditor가 onEditor로 위로 끌어올린 ref를 받는다.
  const [editor, setEditor] = useState<Editor | null>(null);
  // 제목은 우리가 별도로 들고 있다가 commit 시점(blur/Enter)에 부모로 흘려보낸다.
  // Cycle 36-followup — TopNav 만들기로 갓 만든 draft는 title="제목 없음"
  // 기본값으로 들어오는데, 그대로 보여주면 사용자가 placeholder처럼 인식해
  // 그대로 발행한다. 첫 발행 전 draft + 기본 제목이면 input은 비워두고
  // placeholder("페이지 제목")로 안내 → 사용자가 직접 입력하도록.
  const isFreshDraft = !page.publishedAt && page.title === "제목 없음";
  const [title, setTitle] = useState(isFreshDraft ? "" : page.title);
  // 발행 코멘트.
  const [note, setNote] = useState("");
  // 단어/글자 수 — editor.getText() 기반. transaction마다 갱신.
  const [stats, setStats] = useState({ words: 0, chars: 0 });
  // Cycle 36-followup — 빈 제목으로 발행 시도 시 AUI 스타일 에러 노출.
  const [titleError, setTitleError] = useState(false);
  // title input 포커스를 코드에서 옮기기 위한 ref.
  const titleInputRef = useRef<HTMLInputElement>(null);

  // 페이지가 바뀌면 (실제로는 key로 리마운트되지만 안전하게) 제목/노트 리셋.
  useEffect(() => {
    setTitle(isFreshDraft ? "" : page.title);
    setNote("");
    setTitleError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  // editor가 준비되면 단어 수 추적 + 컨텍스트에 맞는 영역에 포커스.
  useEffect(() => {
    if (!editor) return;
    const recompute = () => {
      const text = editor.getText();
      const trimmed = text.trim();
      setStats({
        words: trimmed ? trimmed.split(/\s+/).length : 0,
        chars: text.length,
      });
    };
    recompute();
    editor.on("update", recompute);
    editor.on("transaction", recompute);
    // Cycle 36 followup — 포커스 정책:
    //  - fresh draft(첫 진입, 제목이 비어 있음)는 제목 input으로 포커스 →
    //    사용자에게 "편집기가 열렸고 제목부터 입력하세요" 시각적 단서 제공
    //  - 그 외(기존 페이지 재편집)는 본문 끝으로 포커스 → 바로 이어서 작성
    requestAnimationFrame(() => {
      if (isFreshDraft) {
        titleInputRef.current?.focus();
      } else {
        editor.commands.focus("end");
      }
    });
    return () => {
      editor.off("update", recompute);
      editor.off("transaction", recompute);
    };
  }, [editor, isFreshDraft]);

  // Esc로 빠져나가기 — 단, 본문 contenteditable 안에서의 Esc는 무시 (선택 해제 등
  // 에디터 내부 의미가 있을 수 있고, 의도치 않은 종료를 막는다).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t?.isContentEditable) return;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const commitTitle = () => {
    const next = title.trim();
    if (next && next !== page.title) {
      onTitleChange(next);
    } else if (!next && !isFreshDraft) {
      // 기존 페이지/한 번이라도 제목을 정한 draft에서 빈 값으로 blur하면
      // 마지막 저장 제목으로 되돌린다. fresh draft(첫 진입)는 placeholder
      // 상태 그대로 두어 사용자가 직접 입력하도록 안내.
      setTitle(page.title);
    }
  };

  const saveLabel = (() => {
    switch (saveStatus) {
      case "saving":
        return { text: "저장 중...", cls: "text-[#6b778c]" };
      case "saved":
        return { text: "변경 사항 저장됨", cls: "text-[#006644]" };
      case "error":
        return { text: "저장 실패", cls: "text-[#de350b]" };
      default:
        return { text: "", cls: "" };
    }
  })();

  return (
    // Cycle 35 — TopNav(h-14)는 그대로 노출. fixed top-14로 그 아래만 덮음.
    // z-40으로 사이드바·본문 위에 얹되, TopNav(셸 안 일반 flow)는 가리지 않는다.
    <div className="fixed left-0 right-0 bottom-0 top-14 z-40 bg-white flex flex-col">
      {/* 1) 상단 툴바 — Cycle 37: border-b/bg-white/내부 padding은 EditorToolbar가
          자체 갖는다. 여기선 sticky 위치만 책임. */}
      <div className="sticky top-0 z-20 bg-white">
        {editor ? (
          <EditorToolbar editor={editor} />
        ) : (
          // 에디터 초기화 전 공간을 비워두면 본문이 점프해 보이므로 자리 확보.
          <div className="h-[42px] border-b border-[#dfe1e6]" />
        )}
      </div>

      {/* 2) breadcrumb + 페이지 도구 — Cycle 35: 좌측 정렬 + 넉넉한 가로 패딩. */}
      <div className="border-b border-[#dfe1e6] bg-white">
        <div className="px-8 lg:px-12 xl:px-16 py-2 flex items-center justify-between text-[12px] text-[#6b778c]">
          <nav className="flex flex-wrap items-center gap-1">
            {space && <span>{space.name}</span>}
            {ancestors.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <span>/</span>
                <span>{c.title}</span>
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled
              title="라벨은 추후 지원 예정입니다"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[#a5adba] cursor-not-allowed"
            >
              🏷️ 라벨
            </button>
            <button
              type="button"
              disabled
              title="페이지 제한은 추후 지원 예정입니다"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[#a5adba] cursor-not-allowed"
            >
              🔒 제한
            </button>
          </div>
        </div>
      </div>

      {/* 3) 제목 + 4) 본문 — Cycle 35: 좌측 기준, 가운데 정렬(mx-auto) 제거.
          Cycle 38 followup: max-w-5xl 폭 제한 제거 — 사용자가 한 줄 글자 수가
          좁다(58자)고 요청. 좌우 패딩만 남겨 사이드바·TopNav 사이의 가용 폭을
          전부 사용. (별도 max-width 없음) */}
      <div className="flex-1 overflow-auto">
        <div className="px-8 lg:px-12 xl:px-16 pt-6 pb-12">
          {/* Cycle 36-followup — 빈 제목 발행 시도 에러. AUI 클래스명은 사용자
              요청대로 그대로 두되(향후 AUI 스타일 로딩 시 자동 매칭), 현재는
              Tailwind로 동등한 빨간 배너를 그린다. */}
          {titleError && (
            <div
              className="aui-message closeable aui-message-error relative mb-3 px-4 py-3 pr-10 bg-[#ffebe6] border border-[#de350b] rounded text-[#bf2600]"
              role="alert"
            >
              <p className="title text-[14px] mb-0.5">
                <strong>이 페이지의 이름이 필요합니다</strong>
              </p>
              <span className="empty-title text-[13px]">
                발행 버튼을 누르기 전에 페이지 제목을 추가하세요.
              </span>
              <button
                type="button"
                className="aui-close-button absolute right-2 top-2 w-6 h-6 flex items-center justify-center text-[16px] leading-none text-[#bf2600] hover:bg-[#ffd5cc] rounded"
                aria-label="닫기"
                onClick={() => setTitleError(false)}
              >
                ×
              </button>
            </div>
          )}
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value.trim() && titleError) setTitleError(false);
            }}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitle();
                editor?.commands.focus("start");
              }
            }}
            placeholder="페이지 제목"
            className={`w-full text-[32px] leading-tight font-bold text-[#172b4d] bg-transparent outline-none border-0 px-0 py-2 placeholder-[#a5adba] ${
              titleError ? "underline decoration-[#de350b] decoration-2" : ""
            }`}
          />
          <div className="mt-2">
            <CollaborativeEditor
              key={`fs-${page.id}`}
              pageId={page.id}
              initialMarkdown={page.draftContent ?? page.content}
              editable
              hideToolbar
              onEditor={setEditor}
              onSaveStatusChange={onSaveStatusChange}
              onConnectionStateChange={onConnectionStateChange}
              onPresenceChange={onPresenceChange}
            />
          </div>
        </div>
      </div>

      {/* 5) 하단 바 */}
      <div className="sticky bottom-0 z-20 border-t border-[#dfe1e6] bg-white px-4 py-2 flex items-center gap-3">
        <span className="text-[12px] text-[#6b778c] tabular-nums">
          단어 {stats.words} · 글자 {stats.chars}
        </span>
        {saveLabel.text && (
          <span className={`text-[12px] ${saveLabel.cls}`}>
            {saveLabel.text}
          </span>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="무엇을 변경했나요?"
          maxLength={256}
          className="flex-1 min-w-[200px] max-w-[420px] px-3 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-[#deebff]"
        />
        <label
          className="inline-flex items-center gap-1 text-[12px] text-[#a5adba] cursor-not-allowed"
          title="알림 기능은 추후 지원 예정입니다"
        >
          <input
            type="checkbox"
            disabled
            className="cursor-not-allowed accent-[#0052cc]"
          />
          지켜보기 알림
        </label>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          disabled={publishing}
          className="inline-flex items-center px-3 py-1.5 rounded text-[13px] text-[#42526e] hover:bg-[#ebecf0] disabled:opacity-50"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={() => {
            // Cycle 36-followup — 빈 제목 검증 (AUI 스타일 에러 노출).
            const trimmedTitle = title.trim();
            if (!trimmedTitle) {
              setTitleError(true);
              titleInputRef.current?.focus();
              return;
            }
            // pending 제목 변경이 있으면 발행 전에 PATCH로 커밋 — blur 없이 바로
            // 발행 클릭한 케이스 보호. 발행 후엔 currentPage가 다시 로드되며
            // 최신 제목이 반영된다.
            if (trimmedTitle !== page.title) {
              onTitleChange(trimmedTitle);
            }
            // Cycle 36 — 편집기 현재 컨텐츠를 직접 추출해 발행에 동봉.
            // editor가 아직 안 떴으면 빈 문자열로 폴백 — 빈 본문 발행은
            // 백엔드가 허용(content="" explicit).
            // Cycle 57 — markdown 대신 ProseMirror JSON 직렬화 (mention/
            //   figcaption/inline 댓글 등 사용자 정의 노드 라운드트립 보장).
            //   기존 markdown 직렬화의 한계 해소.
            const md = editor ? JSON.stringify(editor.getJSON()) : "";
            onPublish(md, note.trim());
          }}
          // Cycle 36-followup — 첫 발행(publishedAt=null)이면 hasDraft 게이트
          // 풀기. 이전엔 자동저장 5초 디바운스가 끝나야 hasDraft=true가 되어
          // 사용자가 한참 기다려야 했다. 빈 본문도 발행할 수 있어야 한다는
          // 요구를 동시에 만족.
          // 재발행은 기존대로 hasDraft 검사 — 변경이 있어야만 활성.
          disabled={publishing || (page.publishedAt != null && !hasDraft)}
          className="inline-flex items-center px-3 py-1.5 rounded text-[13px] font-semibold bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
          title={
            page.publishedAt
              ? hasDraft
                ? "변경 사항을 업데이트합니다"
                : "발행할 변경 사항이 없습니다"
              : "이 페이지를 처음으로 발행합니다"
          }
        >
          {/* 한 번도 발행 안 된 draft는 "발행", 이후 재발행은 "업데이트". */}
          {publishing
            ? page.publishedAt
              ? "업데이트 중..."
              : "발행 중..."
            : page.publishedAt
              ? "업데이트"
              : "발행"}
        </button>
      </div>
    </div>
  );
}
