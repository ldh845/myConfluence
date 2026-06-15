"use client";

import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import AppIcon from "@/components/AppIcon";

// Cycle 85 — 정보 패널 NodeView. 파란 배경 + 좌측 강조선 + (선택) 아이콘/제목.
//   본문은 NodeViewContent 로 ProseMirror 가 관리(편집 가능).
export default function InfoPanelNodeView({ node }: NodeViewProps) {
  const title = (node.attrs.title as string) || "";
  const showIcon = node.attrs.showIcon !== false;
  return (
    <NodeViewWrapper className="my-2 rounded border-l-4 border-[#0052cc] bg-[#deebff] p-3">
      <div className="flex items-start gap-2">
        {showIcon && (
          <span
            aria-hidden
            contentEditable={false}
            className="text-[#0052cc] leading-none mt-0.5 shrink-0 select-none"
          >
            <AppIcon name="information" size={18} alt="정보" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <div
              contentEditable={false}
              className="font-semibold text-[#172b4d] text-[14px] mb-1 select-none"
            >
              {title}
            </div>
          )}
          <NodeViewContent className="info-panel-content text-[14px] text-[#172b4d]" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
