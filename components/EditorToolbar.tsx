"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

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
      </BtnGroup>
      {editor.isActive("table") && (
        <>
          <Divider />
          <BtnGroup>
            <TB
              title="열 추가"
              onClick={run(() =>
                editor.chain().focus().addColumnAfter().run()
              )}
            >
              +열
            </TB>
            <TB
              title="행 추가"
              onClick={run(() => editor.chain().focus().addRowAfter().run())}
            >
              +행
            </TB>
            <TB
              title="열 삭제"
              onClick={run(() =>
                editor.chain().focus().deleteColumn().run()
              )}
            >
              −열
            </TB>
            <TB
              title="행 삭제"
              onClick={run(() => editor.chain().focus().deleteRow().run())}
            >
              −행
            </TB>
            <TB
              title="표 삭제"
              onClick={run(() => editor.chain().focus().deleteTable().run())}
            >
              ×표
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

function LinkButton({ editor }: { editor: Editor }) {
  const set = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL (비우면 제거):", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  };
  return (
    <TB
      title="링크"
      active={editor.isActive("link")}
      onClick={set}
    >
      🔗
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
