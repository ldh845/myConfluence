"use client";

// Cycle 37 — Confluence "The Editor" 패턴의 평평한 가로 툴바.
// 좌→우 그룹 배치, 그룹 사이 세로 구분선, 그룹 안은 인접 버튼.
//   [G1] 문단 스타일 드롭다운 ("문단 ▾")
//   [G2] B / I / U / S
//   [G3] 인라인 코드  | 글자색 / 형광펜
//   [G4] 글머리 / 번호 / 체크리스트
//   [G5] 링크 / 표 / 이미지 / 수평선 / 인라인 댓글
//   [컨텍스트] 코드블록 언어 · 이미지 alt · 표 행/열 (선택 노드 따라 노출)
//   ─ flex spacer ─
//   [G6] 실행 취소 / 다시 실행
//
// 레이아웃: 자체 border-b만 갖고 sticky/padding은 부모(FullScreenEditor) 책임.

import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { CODE_BLOCK_LANGUAGES } from "@/lib/tiptap/code-block-lowlight";
import EditorColorPicker from "@/components/EditorColorPicker";
import InternalPageLinkDialog from "@/components/InternalPageLinkDialog";
import InlineCommentDialog from "@/components/InlineCommentDialog";
import ImageInsertDialog from "@/components/ImageInsertDialog";
import { usePageStore } from "@/lib/stores/usePageStore";
import { useEditorUiStore } from "@/lib/stores/useEditorUiStore";
import { SLASH_ITEMS, filterItems } from "@/lib/tiptap/slash-commands";
import type { SlashCommandItem } from "@/lib/tiptap/slash-commands";

type Props = { editor: Editor | null };

export default function EditorToolbar({ editor }: Props) {
  const [, force] = useState(0);

  // 선택/트랜잭션마다 active state가 갱신되어야 한다.
  useEffect(() => {
    if (!editor) return;
    const h = () => force((n) => n + 1);
    editor.on("selectionUpdate", h);
    editor.on("transaction", h);
    return () => {
      editor.off("selectionUpdate", h);
      editor.off("transaction", h);
    };
  }, [editor]);

  if (!editor) return null;
  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs);

  const run = (fn: () => void) => () => {
    fn();
    editor.chain().focus().run();
  };

  // Cycle 63 followup 3 — 정렬 버튼이 이미지 선택 시 image align attr 을,
  //   그 외에는 텍스트 정렬(TextAlign)을 적용. 이미지 배치를 별도 toolbar 가
  //   아닌 에디터 정렬 버튼으로 통합.
  const applyAlign = (dir: "left" | "center" | "right") => {
    if (editor.isActive("image")) {
      editor.chain().focus().updateAttributes("image", { align: dir }).run();
    } else {
      editor.chain().focus().setTextAlign(dir).run();
    }
  };
  const alignActive = (dir: "left" | "center" | "right") => {
    if (editor.isActive("image")) {
      const a = editor.getAttributes("image").align as string | null;
      return dir === "left" ? !a || a === "left" : a === dir;
    }
    if (dir === "left") {
      return (
        editor.isActive({ textAlign: "left" }) ||
        (!editor.isActive({ textAlign: "center" }) &&
          !editor.isActive({ textAlign: "right" }))
      );
    }
    return editor.isActive({ textAlign: dir });
  };

  return (
    <div className="bg-white border-b border-[#dfe1e6] px-3 py-1.5 flex flex-wrap items-center gap-1">
      {/* G1: 문단 스타일 드롭다운 — 제목 1~4 / 인용 / 코드 블록 / 문단 */}
      <ParagraphStyleDropdown editor={editor} />
      <Divider />

      {/* G2: 굵게 / 기울임 / 밑줄 + 취소선 드롭다운 (취소선/위·아래첨자/등간격/서식지우기) */}
      <BtnGroup>
        <TB
          title="굵게 (Ctrl+B)"
          active={isActive("bold")}
          onClick={run(() => editor.chain().focus().toggleBold().run())}
        >
          <b>B</b>
        </TB>
        <TB
          title="기울임 (Ctrl+I)"
          active={isActive("italic")}
          onClick={run(() => editor.chain().focus().toggleItalic().run())}
        >
          <i>I</i>
        </TB>
        <TB
          title="밑줄 (Ctrl+U)"
          active={isActive("underline")}
          onClick={run(() => editor.chain().focus().toggleUnderline().run())}
        >
          <u>U</u>
        </TB>
        <MoreInlineDropdown editor={editor} />
      </BtnGroup>
      <Divider />

      {/* G3: 글자색 / 형광펜 */}
      <BtnGroup>
        <EditorColorPicker editor={editor} kind="text" />
        <EditorColorPicker editor={editor} kind="highlight" />
      </BtnGroup>
      <Divider />

      {/* G4: 목록 + 들여쓰기 + 텍스트 정렬 (Cycle 38) */}
      <BtnGroup>
        <TB
          title="단추형 목록 (Ctrl+Shift+B)"
          active={isActive("bulletList")}
          onClick={run(() => editor.chain().focus().toggleBulletList().run())}
        >
          •
        </TB>
        <TB
          title="번호형 목록 (Ctrl+Shift+N)"
          active={isActive("orderedList")}
          onClick={run(() => editor.chain().focus().toggleOrderedList().run())}
        >
          1.
        </TB>
        <TB
          title="작업 목록"
          active={isActive("taskList")}
          onClick={run(() => editor.chain().focus().toggleTaskList().run())}
        >
          ☑
        </TB>
      </BtnGroup>
      <MiniDivider />
      {/* 들여쓰기 / 내어쓰기 — 리스트 항목에만 의미 있음. 그 외엔 비활성. */}
      <BtnGroup>
        <IndentButton editor={editor} direction="outdent" />
        <IndentButton editor={editor} direction="indent" />
      </BtnGroup>
      <MiniDivider />
      {/* 텍스트 정렬 — paragraph + heading 대상. Cycle 63 followup 3:
          이미지 선택 시엔 이미지 배치(좌/가운데/우)에도 적용. */}
      <BtnGroup>
        <TB
          title="좌측 정렬"
          active={alignActive("left")}
          onClick={() => applyAlign("left")}
        >
          <AlignIcon dir="left" />
        </TB>
        <TB
          title="가운데 정렬"
          active={alignActive("center")}
          onClick={() => applyAlign("center")}
        >
          <AlignIcon dir="center" />
        </TB>
        <TB
          title="우측 정렬"
          active={alignActive("right")}
          onClick={() => applyAlign("right")}
        >
          <AlignIcon dir="right" />
        </TB>
      </BtnGroup>
      <Divider />

      {/* G5: 삽입 — 링크 / 표 / 이미지 / 수평선 / 인라인 댓글 / + 더 많은 내용 */}
      <BtnGroup>
        <LinkButton editor={editor} />
        <TableButton editor={editor} />
        <ImageButton editor={editor} />
        <TB
          title="수평선"
          onClick={run(() =>
            editor.chain().focus().setHorizontalRule().run()
          )}
        >
          ―
        </TB>
        <InlineCommentButton editor={editor} />
        {/* Cycle 54-D — '+ 더 많은 내용 삽입' 버튼. slash 명령 카탈로그
            (SLASH_ITEMS) 를 재활용해 검색 + 클릭만으로 같은 블록 삽입 흐름 제공. */}
        <InsertMoreButton editor={editor} />
      </BtnGroup>

      {/* 컨텍스트별 보조 도구 */}
      {editor.isActive("codeBlock") && (
        <>
          <Divider />
          <CodeBlockLanguageSelect editor={editor} />
        </>
      )}
      {editor.isActive("image") && (
        <>
          <Divider />
          <ImageAltButton editor={editor} />
          <ImageCaptionButton editor={editor} />
        </>
      )}
      {editor.isActive("table") && (
        <>
          <Divider />
          {/* FR-032 (Cycle 14) — 행/열 추가·삭제 + 셀 병합/분할 + 표 삭제. */}
          <BtnGroup>
            <TB
              title="행 추가 (위)"
              onClick={run(() =>
                editor.chain().focus().addRowBefore().run()
              )}
            >
              ⬆+
            </TB>
            <TB
              title="행 추가 (아래)"
              onClick={run(() => editor.chain().focus().addRowAfter().run())}
            >
              ⬇+
            </TB>
            <TB
              title="행 삭제"
              onClick={run(() => editor.chain().focus().deleteRow().run())}
            >
              ⬌−
            </TB>
            <TB
              title="열 추가 (왼쪽)"
              onClick={run(() =>
                editor.chain().focus().addColumnBefore().run()
              )}
            >
              ⬅+
            </TB>
            <TB
              title="열 추가 (오른쪽)"
              onClick={run(() =>
                editor.chain().focus().addColumnAfter().run()
              )}
            >
              ➡+
            </TB>
            <TB
              title="열 삭제"
              onClick={run(() =>
                editor.chain().focus().deleteColumn().run()
              )}
            >
              ⬍−
            </TB>
            <TB
              title="셀 병합 (먼저 두 개 이상 셀 드래그 선택)"
              onClick={run(() => editor.chain().focus().mergeCells().run())}
            >
              ⊞⊟
            </TB>
            <TB
              title="셀 분할"
              onClick={run(() => editor.chain().focus().splitCell().run())}
            >
              ⊟⊞
            </TB>
            <TB
              title="표 삭제"
              onClick={run(() => editor.chain().focus().deleteTable().run())}
            >
              🗑️
            </TB>
          </BtnGroup>
        </>
      )}

      <div className="flex-1" />

      {/* G6: 실행 취소 / 다시 실행 */}
      <BtnGroup>
        <TB
          title="실행 취소 (Ctrl+Z)"
          onClick={run(() => editor.chain().focus().undo().run())}
        >
          ↶
        </TB>
        <TB
          title="다시 실행 (Ctrl+Y)"
          onClick={run(() => editor.chain().focus().redo().run())}
        >
          ↷
        </TB>
      </BtnGroup>
    </div>
  );
}

function BtnGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Divider() {
  return <div className="w-px h-5 bg-[#dfe1e6] mx-1" />;
}

function TB({
  label,
  children,
  title,
  active,
  disabled,
  onClick,
}: {
  label?: string;
  children?: React.ReactNode;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[28px] h-7 px-2 rounded text-[13px] flex items-center justify-center ${
        disabled
          ? "text-[#a5adba] cursor-not-allowed"
          : active
            ? "bg-[#deebff] text-[#0052cc]"
            : "text-[#42526e] hover:bg-[#ebecf0]"
      }`}
    >
      {children ?? label}
    </button>
  );
}

// Cycle 38 — 그룹 안에서 sub-그룹을 살짝 갈라 보일 정도의 약한 구분선.
// 일반 Divider보다 마진/높이를 줄여 시각적 노이즈를 줄인다.
function MiniDivider() {
  return <div className="w-px h-4 bg-[#dfe1e6] mx-0.5" />;
}

// Cycle 38 (+followup) — 들여쓰기/내어쓰기 버튼.
// 컨텍스트별 동작:
//   · taskItem 안 → sink/liftListItem("taskItem")
//   · listItem 안 → sink/liftListItem("listItem")
//   · paragraph/heading → BlockIndent 익스텐션의 indent 속성 ±1
//
// 어떤 컨텍스트에서도 동작 가능하도록 일반 문단도 indent 속성으로 처리한다.
// 비활성 조건은 자연 한계뿐: 들여쓰기는 indent==MAX 일 때, 내어쓰기는
// indent==0 일 때(또는 리스트 최상위 단계).
const INDENT_MAX = 8;
const INDENT_TYPES = ["paragraph", "heading"];

function IndentButton({
  editor,
  direction,
}: {
  editor: Editor;
  direction: "indent" | "outdent";
}) {
  const inTask = editor.isActive("taskItem");
  const inList = editor.isActive("listItem");

  // 가능 여부 — 활성 컨텍스트에 따라 분기.
  const can = (() => {
    if (inTask) {
      return direction === "indent"
        ? editor.can().sinkListItem("taskItem")
        : editor.can().liftListItem("taskItem");
    }
    if (inList) {
      return direction === "indent"
        ? editor.can().sinkListItem("listItem")
        : editor.can().liftListItem("listItem");
    }
    // 문단/제목: indent 속성 한계만 검사.
    const node = editor.state.selection.$anchor.parent;
    if (!INDENT_TYPES.includes(node.type.name)) return false;
    const cur = (node.attrs as { indent?: number }).indent ?? 0;
    return direction === "indent" ? cur < INDENT_MAX : cur > 0;
  })();

  const onClick = () => {
    if (!can) return;
    if (inTask) {
      const cmd = direction === "indent" ? "sinkListItem" : "liftListItem";
      editor.chain().focus()[cmd]("taskItem").run();
      return;
    }
    if (inList) {
      const cmd = direction === "indent" ? "sinkListItem" : "liftListItem";
      editor.chain().focus()[cmd]("listItem").run();
      return;
    }
    // 문단/제목 — indent 속성 ±1.
    const node = editor.state.selection.$anchor.parent;
    if (!INDENT_TYPES.includes(node.type.name)) return;
    const cur = (node.attrs as { indent?: number }).indent ?? 0;
    const next =
      direction === "indent"
        ? Math.min(INDENT_MAX, cur + 1)
        : Math.max(0, cur - 1);
    if (next === cur) return;
    editor
      .chain()
      .focus()
      .updateAttributes(node.type.name, { indent: next })
      .run();
  };

  return (
    <TB
      title={direction === "indent" ? "들여쓰기" : "내어쓰기"}
      disabled={!can}
      onClick={onClick}
    >
      <IndentIcon direction={direction} />
    </TB>
  );
}

// Cycle 38 — Feather/Lucide 스타일 아이콘 베이스 (16px stroke=currentColor).
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function IndentIcon({ direction }: { direction: "indent" | "outdent" }) {
  // outdent(내어쓰기) = chevron이 왼쪽을 가리킴 (텍스트가 왼쪽으로 빠져나감)
  // indent(들여쓰기) = chevron이 오른쪽을 가리킴 (텍스트가 오른쪽으로 들어감)
  return (
    <Icon>
      {direction === "outdent" ? (
        <polyline points="7 8 3 12 7 16" />
      ) : (
        <polyline points="3 8 7 12 3 16" />
      )}
      <line x1="21" y1="6" x2="11" y2="6" />
      <line x1="21" y1="12" x2="11" y2="12" />
      <line x1="21" y1="18" x2="11" y2="18" />
    </Icon>
  );
}

function AlignIcon({ dir }: { dir: "left" | "center" | "right" }) {
  // 4줄 — 위/아래 줄은 항상 페이지 폭(3~21), 가운데 두 줄은 정렬 방향에 따라 짧음.
  if (dir === "left") {
    return (
      <Icon>
        <line x1="21" y1="6" x2="3" y2="6" />
        <line x1="17" y1="10" x2="3" y2="10" />
        <line x1="21" y1="14" x2="3" y2="14" />
        <line x1="17" y1="18" x2="3" y2="18" />
      </Icon>
    );
  }
  if (dir === "center") {
    return (
      <Icon>
        <line x1="21" y1="6" x2="3" y2="6" />
        <line x1="18" y1="10" x2="6" y2="10" />
        <line x1="21" y1="14" x2="3" y2="14" />
        <line x1="18" y1="18" x2="6" y2="18" />
      </Icon>
    );
  }
  return (
    <Icon>
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="10" x2="7" y2="10" />
      <line x1="21" y1="14" x2="3" y2="14" />
      <line x1="21" y1="18" x2="7" y2="18" />
    </Icon>
  );
}

// Cycle 37 — Confluence "Paragraph ▾" 드롭다운.
// 현재 블록 타입에 따라 라벨이 바뀌고, 메뉴 항목엔 각 스타일의 미리보기가 적용된다.
function ParagraphStyleDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 현재 블록 타입을 라벨로 해석.
  // Cycle 37 followup — H1~H6 모두 표시. 코드 블록은 G5의 표/이미지처럼 "삽입" 성격이라
  // 이 드롭다운에선 제외(원하는 사용자는 ``` 자동 변환 / 슬래시 메뉴로 진입).
  const currentLabel = (() => {
    for (const lvl of [1, 2, 3, 4, 5, 6] as const) {
      if (editor.isActive("heading", { level: lvl })) return `제목 ${lvl}`;
    }
    if (editor.isActive("blockquote")) return "인용";
    if (editor.isActive("codeBlock")) return "코드 블록";
    return "문단";
  })();

  // setParagraph 후 toggleHeading: 다른 블록(인용/코드블록)에서도 제목으로
  // 깔끔하게 전환. 같은 제목 레벨 누르면 toggleHeading이 다시 문단으로
  // 떨어뜨리므로 별도 "문단" 항목 없이도 되돌리기 가능.
  const setHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) => () =>
    editor
      .chain()
      .focus()
      .setParagraph()
      .toggleHeading({ level })
      .run();

  type Item = {
    label: string;
    preview: React.ReactNode;
    action: () => void;
    active: boolean;
  };

  // 제목 레벨별 미리보기 크기 (Confluence 톤). H1=22px → H6=11px 단계적 축소.
  const headingPreviewSize: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
    1: "text-[22px]",
    2: "text-[18px]",
    3: "text-[16px]",
    4: "text-[14px]",
    5: "text-[12px]",
    6: "text-[11px]",
  };

  const items: Item[] = [
    ...([1, 2, 3, 4, 5, 6] as const).map<Item>((lvl) => ({
      label: `제목 ${lvl}`,
      preview: (
        <span
          className={`${headingPreviewSize[lvl]} font-bold text-[#172b4d] leading-tight`}
        >
          제목 {lvl}
        </span>
      ),
      action: setHeading(lvl),
      active: editor.isActive("heading", { level: lvl }),
    })),
    {
      label: "인용",
      preview: (
        <span className="text-[13px] text-[#42526e] italic border-l-2 border-[#0052cc] pl-2">
          인용
        </span>
      ),
      action: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive("blockquote"),
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`min-w-[96px] h-7 px-2 rounded text-[13px] flex items-center justify-between gap-2 ${
          open
            ? "bg-[#ebecf0] text-[#172b4d]"
            : "text-[#42526e] hover:bg-[#ebecf0]"
        }`}
        title="문단 스타일"
      >
        <span className="truncate">{currentLabel}</span>
        <span className="text-[10px] text-[#6b778c] shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-[200px] bg-white border border-[#dfe1e6] rounded shadow-lg z-30 py-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.action();
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 hover:bg-[#deebff] flex items-center justify-between gap-2 ${
                item.active ? "bg-[#deebff]" : ""
              }`}
            >
              {item.preview}
              {item.active && (
                <span className="text-[#0052cc] text-[12px] shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Cycle 37 followup — 취소선 트리거를 누르면 열리는 인라인 서식 드롭다운.
// 메뉴: 취소선 / 아래첨자 / 윗첨자 / 등간격(인라인 코드) / 서식지우기.
// "등간격"은 Confluence 한국어판에서 inline code mark을 부르는 표기 — 같은 mark 사용.
function MoreInlineDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 트리거의 active 표시 — 메뉴 안 어떤 mark든 활성이면 강조.
  const anyActive =
    editor.isActive("strike") ||
    editor.isActive("subscript") ||
    editor.isActive("superscript") ||
    editor.isActive("code");

  type Item = {
    label: string;
    preview: React.ReactNode;
    action: () => void;
    active: boolean;
  };

  const items: Item[] = [
    {
      label: "취소선",
      preview: <s className="text-[13px] text-[#172b4d]">취소선</s>,
      action: () => editor.chain().focus().toggleStrike().run(),
      active: editor.isActive("strike"),
    },
    {
      label: "아래첨자",
      preview: (
        <span className="text-[13px] text-[#172b4d]">
          X<sub>아래첨자</sub>
        </span>
      ),
      action: () => editor.chain().focus().toggleSubscript().run(),
      active: editor.isActive("subscript"),
    },
    {
      label: "윗첨자",
      preview: (
        <span className="text-[13px] text-[#172b4d]">
          X<sup>윗첨자</sup>
        </span>
      ),
      action: () => editor.chain().focus().toggleSuperscript().run(),
      active: editor.isActive("superscript"),
    },
    {
      label: "등간격",
      preview: (
        <code className="text-[12px] font-mono text-[#172b4d] bg-[#f4f5f7] px-1.5 py-0.5 rounded">
          등간격
        </code>
      ),
      action: () => editor.chain().focus().toggleCode().run(),
      active: editor.isActive("code"),
    },
    {
      label: "서식 지우기",
      preview: <span className="text-[13px] text-[#42526e]">서식 지우기</span>,
      // marks만 정리. clearNodes()까지 호출하면 제목/리스트 등 노드 구조도 풀려
      // 의도와 다를 수 있어 unsetAllMarks만 호출.
      action: () => editor.chain().focus().unsetAllMarks().run(),
      active: false,
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="추가 인라인 서식"
        className={`min-w-[28px] h-7 px-2 rounded text-[13px] flex items-center justify-center gap-0.5 ${
          open
            ? "bg-[#ebecf0] text-[#172b4d]"
            : anyActive
              ? "bg-[#deebff] text-[#0052cc]"
              : "text-[#42526e] hover:bg-[#ebecf0]"
        }`}
      >
        <s>S</s>
        <span className="text-[10px] text-[#6b778c]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-[180px] bg-white border border-[#dfe1e6] rounded shadow-lg z-30 py-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.action();
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 hover:bg-[#deebff] flex items-center justify-between gap-2 ${
                item.active ? "bg-[#deebff]" : ""
              }`}
            >
              {item.preview}
              {item.active && (
                <span className="text-[#0052cc] text-[12px] shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CodeBlockLanguageSelect({ editor }: { editor: Editor }) {
  const current =
    (editor.getAttributes("codeBlock").language as string | null) ??
    "plaintext";
  return (
    <select
      title="코드 블록 언어"
      value={current}
      onChange={(e) =>
        editor
          .chain()
          .focus()
          .updateAttributes("codeBlock", { language: e.target.value })
          .run()
      }
      className="h-7 px-2 text-[12px] rounded border border-[#dfe1e6] bg-white text-[#42526e] hover:border-[#0052cc] focus:outline-none focus:border-[#0052cc]"
    >
      {CODE_BLOCK_LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {lang}
        </option>
      ))}
    </select>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const currentHref = editor.getAttributes("link").href as string | undefined;

  // FR-034 (Cycle 11-1) — modal로 외부 URL + 내부 페이지 검색 둘 다 처리.
  const handleSelect = (href: string | null) => {
    if (href === null || href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href })
      .run();
  };

  // Cycle 54-A — Ctrl/Cmd+K 단축키. **편집 모드(editor.isEditable === true)
  //   한정**으로만 링크 다이얼로그를 연다. TopNav 의 검색 오버레이 단축키와
  //   글로벌로 충돌하므로 **capture phase + stopPropagation** 으로 우리 가
  //   먼저 가로채 TopNav 핸들러가 발화하지 않도록 차단. 조회 모드/외부 라우트
  //   에서는 isEditable=false → TopNav 의 검색 단축키가 정상 작동.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editor.isEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editor]);

  return (
    <>
      <TB
        title="링크 (Ctrl+K)"
        active={editor.isActive("link")}
        onClick={() => setOpen(true)}
      >
        🔗
      </TB>
      <InternalPageLinkDialog
        open={open}
        onOpenChange={setOpen}
        onSelect={handleSelect}
        currentHref={currentHref}
      />
    </>
  );
}

// Cycle 54-C — 단순 URL prompt → 통합 다이얼로그(ImageInsertDialog)로 교체.
//   탭: '이 페이지 첨부' (기존 첨부 이미지 + 새 업로드) / '웹에서의 그림' (URL).
//   드롭/붙여넣기 업로드 흐름은 CollaborativeEditor handleDrop/handlePaste(Cycle 12-1)
//   에서 그대로 처리(회귀 없음). pageId 는 usePageStore 에서 가져옴 — TaskItemNodeView
//   와 같은 패턴(NodeView 가 prop 못 받는 한계 회피용 store).
function ImageButton({ editor }: { editor: Editor }) {
  // Cycle 62 — 로컬 open state → 전역 store. slash '/이미지' 도 같은
  //   다이얼로그를 열 수 있게(일관성). 버튼/slash 둘 다 openImageDialog.
  const open = useEditorUiStore((s) => s.imageDialogOpen);
  const openDialog = useEditorUiStore((s) => s.openImageDialog);
  const closeDialog = useEditorUiStore((s) => s.closeImageDialog);
  const pageId = usePageStore((s) => s.pageId);
  const insert = (src: string, alt?: string) => {
    editor.chain().focus().setImage({ src, alt: alt ?? "" }).run();
  };
  return (
    <>
      <TB title="이미지" onClick={openDialog}>
        🖼️
      </TB>
      {pageId && (
        <ImageInsertDialog
          open={open}
          onOpenChange={(v) => (v ? openDialog() : closeDialog())}
          pageId={pageId}
          onSelect={insert}
        />
      )}
    </>
  );
}

// FR-033 (Cycle 12-2) — 선택된 이미지의 alt 편집(접근성용 대체 텍스트).
// Cycle 54-C — '캡션' 의미는 ImageCaptionButton 으로 분리. alt 는 짧은 대체
// 텍스트(스크린리더용), caption 은 그림 아래 설명 — 둘은 별개.
function ImageAltButton({ editor }: { editor: Editor }) {
  const editAlt = () => {
    const current =
      (editor.getAttributes("image").alt as string | undefined) ?? "";
    const next = window.prompt(
      "이미지 대체 텍스트(alt) — 스크린리더용 짧은 설명",
      current,
    );
    if (next === null) return;
    editor.chain().focus().updateAttributes("image", { alt: next }).run();
  };
  return (
    <TB title="이미지 대체 텍스트(alt) 편집" onClick={editAlt}>
      🔤
    </TB>
  );
}

// Cycle 54-C — 그림 아래 캡션(figcaption) 편집. alt 와 분리된 의미.
//   NodeView 의 figcaption 클릭으로도 같은 prompt 가 뜸 — 두 경로 일관.
function ImageCaptionButton({ editor }: { editor: Editor }) {
  const editCaption = () => {
    const current =
      (editor.getAttributes("image").caption as string | undefined) ?? "";
    const next = window.prompt(
      "그림 캡션 — 그림 아래 표시되는 설명",
      current,
    );
    if (next === null) return;
    editor
      .chain()
      .focus()
      .updateAttributes("image", { caption: next.trim() })
      .run();
  };
  return (
    <TB title="이미지 캡션(figcaption) 편집" onClick={editCaption}>
      📝
    </TB>
  );
}

// FR-071 (Cycle 16-3b-1) — 선택 텍스트에 인라인 댓글 작성.
// selection이 비어 있으면 무반응. 작성 성공 시 onCreated로 받은 commentId를
// inlineComment mark에 박는다.
function InlineCommentButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);

  const handleOpen = () => {
    const sel = editor.state.selection;
    if (sel.empty) {
      window.alert("먼저 본문에서 댓글을 달 텍스트를 선택하세요.");
      return;
    }
    const text = editor.state.doc.textBetween(sel.from, sel.to, " ");
    if (!text.trim()) return;
    setSelectedText(text);
    setFrom(sel.from);
    setTo(sel.to);
    setOpen(true);
  };

  const handleCreated = (commentId: string) => {
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .setMark("inlineComment", { commentId })
      .run();
  };

  return (
    <>
      <TB title="인라인 댓글 (텍스트 선택 후)" onClick={handleOpen}>
        💬
      </TB>
      <InlineCommentDialog
        open={open}
        onOpenChange={setOpen}
        selectedText={selectedText}
        anchorFrom={from}
        anchorTo={to}
        onCreated={handleCreated}
      />
    </>
  );
}

function TableButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Cycle 54-B — Confluence 표준 그리드 크기에 맞춰 8 → 10 확장.
  //   셀 폭은 22px 고정으로 두고 popup 너비는 콘텐츠가 결정(w-fit) — 셀이
  //   비좁아지지 않도록. 직접 입력은 그대로 (한도 100x20).
  const MAX = 10;

  const insert = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    setOpen(false);
    setHover({ r: 0, c: 0 });
  };

  return (
    <div className="relative" ref={ref}>
      <TB title="표 삽입" onClick={() => setOpen((v) => !v)}>
        ▦
      </TB>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#dfe1e6] rounded shadow-lg p-2 z-20 w-fit">
          <div className="text-[11px] text-[#6b778c] mb-1">
            {hover.r > 0
              ? `${hover.r} 행 × ${hover.c} 열`
              : "표 크기 선택"}
          </div>
          <div
            className="grid bg-[#f4f5f7] p-1 rounded"
            style={{ gridTemplateColumns: `repeat(${MAX}, 22px)`, gap: 3 }}
            onMouseLeave={() => setHover({ r: 0, c: 0 })}
          >
            {Array.from({ length: MAX * MAX }).map((_, i) => {
              const r = Math.floor(i / MAX) + 1;
              const c = (i % MAX) + 1;
              const active = r <= hover.r && c <= hover.c;
              return (
                <button
                  key={i}
                  onMouseEnter={() => setHover({ r, c })}
                  onClick={() => insert(r, c)}
                  className={`h-5 border rounded-sm ${
                    active
                      ? "bg-[#0052cc] border-[#0052cc]"
                      : "bg-white border-[#dfe1e6] hover:bg-[#deebff]"
                  }`}
                />
              );
            })}
          </div>
          <div className="mt-2 text-[11px] text-[#6b778c]">
            더 크게?{" "}
            <button
              className="text-[#0052cc] hover:underline"
              onClick={() => {
                const v = prompt("행 x 열 (예: 10x6):", "10x6");
                if (!v) return;
                const m = v.match(/^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/);
                if (!m) return alert("형식: 10x6");
                insert(
                  Math.min(100, Math.max(1, parseInt(m[1], 10))),
                  Math.min(20, Math.max(1, parseInt(m[2], 10)))
                );
              }}
            >
              직접 입력
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Cycle 54-D — '+ 더 많은 내용 삽입'. SlashMenu 와 동일한 카탈로그
//   (SLASH_ITEMS) 를 키보드/마우스로 탐색해 같은 .command() 흐름으로 위임.
//   buttontrigger 라 slash 토큰이 없으므로 range 는 현재 커서 위치 (빈 range).
//   slash command 들은 deleteRange 부터 호출하지만 빈 range 에서는 no-op.
function InsertMoreButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = filterItems(query);

  // popup 외부 클릭 시 닫기.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // 열릴 때 검색 input 포커스 + 상태 초기화.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 항목 셋이 바뀌면 선택 reset.
  useEffect(() => setSelected(0), [query]);

  // 선택된 항목이 항상 보이도록 스크롤 동기화.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${selected}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const runItem = (item: SlashCommandItem | undefined) => {
    if (!item) return;
    const pos = editor.state.selection.from;
    // slash 와 같은 시그니처. 빈 range 라 deleteRange 는 no-op.
    item.command({ editor, range: { from: pos, to: pos } });
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (items.length === 0 ? 0 : (s + 1) % items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) =>
        items.length === 0 ? 0 : (s - 1 + items.length) % items.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      runItem(items[selected]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <TB title="더 많은 내용 삽입" onClick={() => setOpen((v) => !v)}>
        ＋
      </TB>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#dfe1e6] rounded-md shadow-lg z-20 w-[260px]">
          <div className="p-2 border-b border-[#dfe1e6]">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="삽입할 항목 검색..."
              className="w-full px-2 py-1 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
            />
          </div>
          <div ref={listRef} className="max-h-[260px] overflow-y-auto py-1">
            {items.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-[#6b778c]">
                결과 없음
              </div>
            ) : (
              items.map((item, i) => {
                const active = i === selected;
                return (
                  <button
                    key={item.title}
                    data-idx={i}
                    type="button"
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => runItem(item)}
                    className={`w-full text-left px-3 py-1.5 text-[13px] flex flex-col ${
                      active
                        ? "bg-[#deebff] text-[#0052cc]"
                        : "text-[#172b4d] hover:bg-[#ebecf0]"
                    }`}
                  >
                    <span className="font-medium">{item.title}</span>
                    <span className="text-[11px] text-[#6b778c]">
                      {item.description}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
