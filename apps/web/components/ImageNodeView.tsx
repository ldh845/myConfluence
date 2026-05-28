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
