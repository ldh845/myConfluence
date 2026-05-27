"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

// Cycle 54-C — Image NodeView. caption attr 가 있으면 figure+figcaption 구조로
// 시각화. 캡션 클릭 시 prompt 로 편집(Yjs 안전 — attribute transaction 으로 전파).
// 읽기 모드에서는 캡션이 있을 때만 표시(빈 캡션은 숨김).
//
// caption attr 자체는 Image extension(.extend) 에서 정의. parseHTML/renderHTML
// 도 거기서 figure 구조 처리. 여기는 화면 렌더 책임만.

type ImageAttrs = {
  src: string;
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
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

  const onEditCaption = () => {
    const next = window.prompt("그림 캡션", caption);
    if (next === null) return;
    updateAttributes({ caption: next.trim() });
  };

  return (
    <NodeViewWrapper
      as="figure"
      className="cf-image-figure my-3 inline-block max-w-full"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="cf-image block max-w-full h-auto"
        draggable={false}
      />
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
