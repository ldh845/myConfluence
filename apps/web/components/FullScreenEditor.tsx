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
import { useEffect, useState } from "react";
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
  const [title, setTitle] = useState(page.title);
  // 발행 코멘트.
  const [note, setNote] = useState("");
  // 단어/글자 수 — editor.getText() 기반. transaction마다 갱신.
  const [stats, setStats] = useState({ words: 0, chars: 0 });

  // 페이지가 바뀌면 (실제로는 key로 리마운트되지만 안전하게) 제목/노트 리셋.
  useEffect(() => {
    setTitle(page.title);
    setNote("");
  }, [page.id]);

  // editor가 준비되면 단어 수 추적 + 본문에 포커스(타이핑 즉시 가능).
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
    // 본문 포커스. 제목이 비어있으면 제목으로 가는 게 자연스럽지만, 그 케이스는
    // ?edit=1로 방금 만든 페이지 정도라서 우선순위가 낮다.
    requestAnimationFrame(() => editor.commands.focus("end"));
    return () => {
      editor.off("update", recompute);
      editor.off("transaction", recompute);
    };
  }, [editor]);

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
    } else if (!next) {
      // 빈 제목은 허용하지 않고 원래대로 되돌린다.
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
      {/* 1) 상단 툴바 */}
      <div className="sticky top-0 z-20 border-b border-[#dfe1e6] bg-white px-6 pt-2">
        {editor ? (
          <EditorToolbar editor={editor} />
        ) : (
          // 에디터 초기화 전 공간을 비워두면 본문이 점프해 보이므로 자리 확보.
          <div className="h-[42px]" />
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
          매우 넓은 화면에서 한 줄이 너무 길어지지 않도록 max-w-5xl만 둔다. */}
      <div className="flex-1 overflow-auto">
        <div className="px-8 lg:px-12 xl:px-16 pt-6 pb-12 max-w-5xl">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitle();
                editor?.commands.focus("start");
              }
            }}
            placeholder="페이지 제목"
            className="w-full text-[32px] leading-tight font-bold text-[#172b4d] bg-transparent outline-none border-0 px-0 py-2 placeholder-[#a5adba]"
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
            // Cycle 36 — 편집기 현재 마크다운을 직접 추출해 발행에 동봉.
            // tiptap-markdown extension의 storage가 getMarkdown을 노출.
            // editor가 아직 안 떴으면 (지연/오류) 빈 문자열로 폴백 — 빈 페이지
            // 발행은 백엔드가 허용한다(content="" explicit).
            const md =
              (
                editor?.storage as
                  | { markdown?: { getMarkdown: () => string } }
                  | undefined
              )?.markdown?.getMarkdown() ?? "";
            onPublish(md, note.trim());
          }}
          disabled={!hasDraft || publishing}
          className="inline-flex items-center px-3 py-1.5 rounded text-[13px] font-semibold bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
          title={
            hasDraft
              ? page.publishedAt
                ? "변경 사항을 업데이트합니다"
                : "이 페이지를 처음으로 발행합니다"
              : "발행할 변경 사항이 없습니다"
          }
        >
          {/* Cycle 36-followup — 한 번도 발행 안 된 draft는 "발행", 이후 재발행은
              "업데이트" (Confluence Publish/Update 동일 패턴). */}
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
