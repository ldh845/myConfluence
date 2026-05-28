"use client";

import { useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

// Cycle 54-C — Image NodeView (figure + figcaption).
// Cycle 63 — 크기 조절(width) + 테두리(border) + 정렬(align float) + 리사이즈
//   핸들(드래그). toolbar/연결은 63-2/63-3.
//   attr 은 Image extension(.extend) 에서 정의. 화면 렌더는 여기서 inline style.

type ImageAttrs = {
  src: string;
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
  width?: number | null;
  border?: boolean | null;
  align?: "left" | "right" | "center" | null;
  link?: string | null;
};

export default function ImageNodeView({
  node,
  updateAttributes,
  editor,
  selected,
}: NodeViewProps) {
  const attrs = node.attrs as ImageAttrs;
  const src = attrs.src;
  const alt = attrs.alt ?? "";
  const caption = (attrs.caption ?? "").trim();
  const editable = editor.isEditable;

  const imgRef = useRef<HTMLImageElement>(null);
  // Cycle 63 — 드래그 중에는 로컬 미리보기 width. mouseup 에 한 번만 commit
  //   (매 mousemove updateAttributes 면 Yjs transaction 폭주).
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const displayWidth = previewWidth ?? attrs.width ?? null;

  const onEditCaption = () => {
    const next = window.prompt("그림 캡션", caption);
    if (next === null) return;
    updateAttributes({ caption: next.trim() });
  };

  const onResizeDown = (e: React.MouseEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = imgRef.current?.offsetWidth ?? 0;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(60, Math.round(startW + (ev.clientX - startX)));
      setPreviewWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setPreviewWidth((w) => {
        if (w != null) updateAttributes({ width: w });
        return null;
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // figure 정렬 — float(좌/우) 또는 가운데. 텍스트가 이미지 옆으로 흐른다.
  const figureStyle: React.CSSProperties = {
    width: displayWidth ? `${displayWidth}px` : undefined,
    maxWidth: "100%",
    ...(attrs.align === "left"
      ? { float: "left", marginRight: 16 }
      : attrs.align === "right"
        ? { float: "right", marginLeft: 16 }
        : attrs.align === "center"
          ? { marginLeft: "auto", marginRight: "auto" }
          : {}),
  };

  return (
    <NodeViewWrapper
      as="figure"
      className="cf-image-figure my-3 inline-block relative"
      style={figureStyle}
    >
      <div className="relative inline-block w-full">
        {/* Cycle 63-2 — 선택 시 floating toolbar. px/원본/테두리/정렬. */}
        {editable && selected && (
          <div className="absolute -top-10 left-0 z-20 flex items-center gap-1 bg-white border border-[#dfe1e6] rounded-md shadow-lg px-1.5 py-1 text-[12px] whitespace-nowrap">
            <input
              type="number"
              min={60}
              value={attrs.width ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                updateAttributes({ width: v ? Number(v) : null });
              }}
              placeholder="px"
              className="w-16 px-1.5 py-0.5 border border-[#dfe1e6] rounded text-[12px] focus:outline-none focus:border-[#0052cc]"
              title="가로 크기(px)"
            />
            <ToolBtn onClick={() => updateAttributes({ width: null })}>
              원본
            </ToolBtn>
            <span className="w-px h-4 bg-[#dfe1e6]" />
            <ToolBtn
              active={!!attrs.border}
              onClick={() => updateAttributes({ border: !attrs.border })}
            >
              테두리
            </ToolBtn>
            <span className="w-px h-4 bg-[#dfe1e6]" />
            <ToolBtn
              active={attrs.align === "left"}
              onClick={() => updateAttributes({ align: "left" })}
              title="왼쪽 (텍스트가 오른쪽으로 흐름)"
            >
              ⬅
            </ToolBtn>
            <ToolBtn
              active={!attrs.align || attrs.align === "center"}
              onClick={() => updateAttributes({ align: "center" })}
              title="가운데"
            >
              ☰
            </ToolBtn>
            <ToolBtn
              active={attrs.align === "right"}
              onClick={() => updateAttributes({ align: "right" })}
              title="오른쪽 (텍스트가 왼쪽으로 흐름)"
            >
              ➡
            </ToolBtn>
            <span className="w-px h-4 bg-[#dfe1e6]" />
            {/* Cycle 63-3 — 연결(link). prompt 로 URL 입력. 빈 값이면 해제. */}
            <ToolBtn
              active={!!attrs.link}
              onClick={() => {
                const next = window.prompt(
                  "이미지 클릭 시 이동할 URL (빈 값이면 연결 해제)",
                  attrs.link ?? "",
                );
                if (next === null) return;
                updateAttributes({ link: next.trim() || null });
              }}
              title="연결"
            >
              🔗
            </ToolBtn>
          </div>
        )}
        {/* Cycle 63-3 — 조회 모드 + link 면 a 로 감싸 클릭 이동. 편집 모드는
            selection/resize 를 위해 a 없이 img 직접. */}
        {!editable && attrs.link ? (
          <a
            href={attrs.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              className="cf-image block w-full h-auto"
              draggable={false}
              style={{
                border: attrs.border ? "1px solid #dfe1e6" : undefined,
                borderRadius: attrs.border ? 4 : undefined,
              }}
            />
          </a>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className="cf-image block w-full h-auto"
            draggable={false}
            style={{
              border: attrs.border ? "1px solid #dfe1e6" : undefined,
              borderRadius: attrs.border ? 4 : undefined,
              outline: selected && editable ? "2px solid #0052cc" : undefined,
            }}
          />
        )}
        {/* Cycle 63 — 우하단 리사이즈 핸들 (편집 모드만). */}
        {editable && (
          <span
            onMouseDown={onResizeDown}
            className="absolute bottom-1 right-1 w-3 h-3 bg-[#0052cc] border border-white rounded-sm"
            style={{ cursor: "nwse-resize" }}
            title="드래그하여 크기 조절"
          />
        )}
      </div>
      {caption ? (
        <figcaption
          className={`cf-image-caption text-[12px] text-[#6b778c] mt-1.5 text-center ${
            editable ? "cursor-pointer hover:text-[#0052cc]" : ""
          }`}
          onClick={editable ? onEditCaption : undefined}
          title={editable ? "클릭하여 캡션 수정" : undefined}
        >
          {caption}
        </figcaption>
      ) : editable ? (
        <figcaption
          className="cf-image-caption-empty text-[12px] text-[#a5adba] italic mt-1.5 text-center cursor-pointer hover:text-[#0052cc]"
          onClick={onEditCaption}
          title="클릭하여 캡션 추가"
        >
          캡션 추가...
        </figcaption>
      ) : null}
    </NodeViewWrapper>
  );
}

// Cycle 63-2 — 이미지 toolbar 버튼. active 시 파란 배경.
function ToolBtn({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-1.5 py-0.5 rounded text-[12px] ${
        active
          ? "bg-[#deebff] text-[#0052cc] font-semibold"
          : "text-[#42526e] hover:bg-[#ebecf0]"
      }`}
    >
      {children}
    </button>
  );
}
