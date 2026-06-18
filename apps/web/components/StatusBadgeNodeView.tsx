"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  STATUS_COLORS,
  isStatusColor,
  type StatusColorKey,
} from "@/lib/tiptap/status-badge";
import { useEditorUiStore } from "@/lib/stores/useEditorUiStore";

// Cycle 85 — 상태 매크로 NodeView. 인라인 알약(pill) 스타일.
// Cycle 89 — 클릭 시 편집 다이얼로그 열기 (편집 모드에서만).
export default function StatusBadgeNodeView({ node, getPos, editor }: NodeViewProps) {
  const text = (node.attrs.text as string) || "";
  const rawColor = node.attrs.color as string;
  const colorKey: StatusColorKey = isStatusColor(rawColor) ? rawColor : "gray";
  const c = STATUS_COLORS[colorKey];

  const handleDoubleClick = () => {
    // 조회 모드(readonly)에서는 반응하지 않음
    if (!editor.isEditable) return;
    const pos = getPos();
    if (pos == null) return;
    useEditorUiStore.getState().openStatusMacro({
      text,
      color: colorKey,
      pos,
    });
  };

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle mx-0.5">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-semibold uppercase tracking-wide leading-none cursor-pointer hover:opacity-80"
        style={{ backgroundColor: c.bg, color: c.text }}
        contentEditable={false}
        onClick={handleDoubleClick}
      >
        {text || "상태"}
      </span>
    </NodeViewWrapper>
  );
}