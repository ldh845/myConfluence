"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { CODE_BLOCK_LANGUAGES } from "@/lib/tiptap/code-block-lowlight";
import EditorColorPicker from "@/components/EditorColorPicker";
import InternalPageLinkDialog from "@/components/InternalPageLinkDialog";

type Props = { editor: Editor | null };

export default function EditorToolbar({ editor }: Props) {
  const [, force] = useState(0);

  // Re-render on selection/transaction so active states update
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
    <div className="sticky top-0 z-10 bg-white border border-[#dfe1e6] rounded mb-3 px-2 py-1.5 flex flex-wrap items-center gap-0.5">
      <BtnGroup>
        <TB
          label="H1"
          active={isActive("heading", { level: 1 })}
          onClick={run(() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          )}
        />
        <TB
          label="H2"
          active={isActive("heading", { level: 2 })}
          onClick={run(() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          )}
        />
        <TB
          label="H3"
          active={isActive("heading", { level: 3 })}
          onClick={run(() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          )}
        />
        <TB
          label="H4"
          active={isActive("heading", { level: 4 })}
          onClick={run(() =>
            editor.chain().focus().toggleHeading({ level: 4 }).run()
          )}
        />
      </BtnGroup>
      <Divider />
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
          onClick={run(() =>
            editor.chain().focus().toggleOrderedList().run()
          )}
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
        <TB
          title="인용"
          active={isActive("blockquote")}
          onClick={run(() =>
            editor.chain().focus().toggleBlockquote().run()
          )}
        >
          ❝
        </TB>
        <TB
          title="코드 블록"
          active={isActive("codeBlock")}
          onClick={run(() => editor.chain().focus().toggleCodeBlock().run())}
        >
          {"{ }"}
        </TB>
        <TB
          title="수평선"
          onClick={run(() =>
            editor.chain().focus().setHorizontalRule().run()
          )}
        >
          ―
        </TB>
      </BtnGroup>
      <Divider />
      <BtnGroup>
        <LinkButton editor={editor} />
        <TableButton editor={editor} />
        <ImageButton editor={editor} />
      </BtnGroup>
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
