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

  return (
    <div className="bg-white border-b border-[#dfe1e6] px-3 py-1.5 flex flex-wrap items-center gap-1">
      {/* G1: 문단 스타일 드롭다운 — 제목 1~4 / 인용 / 코드 블록 / 문단 */}
      <ParagraphStyleDropdown editor={editor} />
      <Divider />

      {/* G2: 굵게 / 기울임 / 밑줄 / 취소선 */}
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
        <TB
          title="취소선"
          active={isActive("strike")}
          onClick={run(() => editor.chain().focus().toggleStrike().run())}
        >
          <s>S</s>
        </TB>
      </BtnGroup>
      <Divider />

      {/* G3: 인라인 코드 + 글자색 / 형광펜 */}
      <BtnGroup>
        <TB
          title="인라인 코드"
          active={isActive("code")}
          onClick={run(() => editor.chain().focus().toggleCode().run())}
        >
          <code>&lt;/&gt;</code>
        </TB>
        <EditorColorPicker editor={editor} kind="text" />
        <EditorColorPicker editor={editor} kind="highlight" />
      </BtnGroup>
      <Divider />

      {/* G4: 목록류 — 글머리 / 번호 / 체크리스트
          (인용 / 코드블록은 G1 드롭다운으로 이관) */}
      <BtnGroup>
        <TB
          title="글머리 목록"
          active={isActive("bulletList")}
          onClick={run(() => editor.chain().focus().toggleBulletList().run())}
        >
          •
        </TB>
        <TB
          title="번호 목록"
          active={isActive("orderedList")}
          onClick={run(() => editor.chain().focus().toggleOrderedList().run())}
        >
          1.
        </TB>
        <TB
          title="체크리스트"
          active={isActive("taskList")}
          onClick={run(() => editor.chain().focus().toggleTaskList().run())}
        >
          ☑
        </TB>
      </BtnGroup>
      <Divider />

      {/* G5: 삽입 — 링크 / 표 / 이미지 / 수평선 / 인라인 댓글 */}
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
  onClick,
}: {
  label?: string;
  children?: React.ReactNode;
  title?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      className={`min-w-[28px] h-7 px-2 rounded text-[13px] flex items-center justify-center ${
        active
          ? "bg-[#deebff] text-[#0052cc]"
          : "text-[#42526e] hover:bg-[#ebecf0]"
      }`}
    >
      {children ?? label}
    </button>
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
  const currentLabel = (() => {
    for (const lvl of [1, 2, 3, 4] as const) {
      if (editor.isActive("heading", { level: lvl })) return `제목 ${lvl}`;
    }
    if (editor.isActive("blockquote")) return "인용";
    if (editor.isActive("codeBlock")) return "코드 블록";
    return "문단";
  })();

  // setParagraph 후 toggleHeading: 다른 블록(인용/코드블록)에서도 제목으로
  // 깔끔하게 전환되도록. 같은 제목 레벨 누르면 toggleHeading이 다시 문단으로.
  const setHeading = (level: 1 | 2 | 3 | 4) => () =>
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

  const isHeading =
    editor.isActive("heading", { level: 1 }) ||
    editor.isActive("heading", { level: 2 }) ||
    editor.isActive("heading", { level: 3 }) ||
    editor.isActive("heading", { level: 4 });
  const isBlockquote = editor.isActive("blockquote");
  const isCodeBlock = editor.isActive("codeBlock");
  const isPlainPara = !isHeading && !isBlockquote && !isCodeBlock;

  const items: Item[] = [
    {
      label: "문단",
      preview: (
        <span className="text-[14px] text-[#172b4d]">문단</span>
      ),
      action: () => editor.chain().focus().setParagraph().run(),
      active: isPlainPara,
    },
    {
      label: "제목 1",
      preview: (
        <span className="text-[22px] font-bold text-[#172b4d] leading-tight">
          제목 1
        </span>
      ),
      action: setHeading(1),
      active: editor.isActive("heading", { level: 1 }),
    },
    {
      label: "제목 2",
      preview: (
        <span className="text-[18px] font-bold text-[#172b4d] leading-tight">
          제목 2
        </span>
      ),
      action: setHeading(2),
      active: editor.isActive("heading", { level: 2 }),
    },
    {
      label: "제목 3",
      preview: (
        <span className="text-[15px] font-bold text-[#172b4d] leading-tight">
          제목 3
        </span>
      ),
      action: setHeading(3),
      active: editor.isActive("heading", { level: 3 }),
    },
    {
      label: "제목 4",
      preview: (
        <span className="text-[13px] font-bold text-[#172b4d] leading-tight">
          제목 4
        </span>
      ),
      action: setHeading(4),
      active: editor.isActive("heading", { level: 4 }),
    },
    {
      label: "인용",
      preview: (
        <span className="text-[13px] text-[#42526e] italic border-l-2 border-[#0052cc] pl-2">
          인용
        </span>
      ),
      action: () =>
        editor.chain().focus().toggleBlockquote().run(),
      active: isBlockquote,
    },
    {
      label: "코드 블록",
      preview: (
        <span className="text-[12px] font-mono text-[#172b4d] bg-[#f4f5f7] px-1.5 py-0.5 rounded">
          코드 블록
        </span>
      ),
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      active: isCodeBlock,
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

  return (
    <>
      <TB
        title="링크"
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

// FR-033 (Cycle 12-2) — 외부 URL 이미지 삽입.
// 드롭/붙여넣기로 들어오는 첨부 업로드 흐름은 CollaborativeEditor의
// handleDrop/handlePaste(Cycle 12-1)에서 처리하므로 여기서는 외부 URL만.
function ImageButton({ editor }: { editor: Editor }) {
  const insert = () => {
    const url = window.prompt("이미지 URL");
    if (!url) return;
    const alt = window.prompt("이미지 캡션(alt 텍스트, 선택)", "") ?? "";
    editor.chain().focus().setImage({ src: url, alt }).run();
  };
  return (
    <TB title="이미지" onClick={insert}>
      🖼️
    </TB>
  );
}

// FR-033 (Cycle 12-2) — 선택된 이미지 노드의 alt 편집(간이 캡션).
// 12-3에서 figure/figcaption 정식 캡션 + 플로팅 UI로 교체 예정.
function ImageAltButton({ editor }: { editor: Editor }) {
  const editAlt = () => {
    const current =
      (editor.getAttributes("image").alt as string | undefined) ?? "";
    const next = window.prompt("이미지 캡션(alt 텍스트)", current);
    if (next === null) return;
    editor.chain().focus().updateAttributes("image", { alt: next }).run();
  };
  return (
    <TB title="이미지 캡션 편집" onClick={editAlt}>
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

  const MAX = 8;

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
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#dfe1e6] rounded shadow-lg p-2 z-20 w-[210px]">
          <div className="text-[11px] text-[#6b778c] mb-1">
            {hover.r > 0
              ? `${hover.r} 행 × ${hover.c} 열`
              : "표 크기 선택"}
          </div>
          <div
            className="grid bg-[#f4f5f7] p-1 rounded"
            style={{ gridTemplateColumns: `repeat(${MAX}, 1fr)`, gap: 3 }}
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
