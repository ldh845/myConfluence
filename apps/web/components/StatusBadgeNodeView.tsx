"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  STATUS_COLORS,
  isStatusColor,
  type StatusColorKey,
} from "@/lib/tiptap/status-badge";
import AppIcon from "@/components/AppIcon";

// Cycle 85 — 상태 매크로 NodeView. 인라인 알약(pill) 스타일.
export default function StatusBadgeNodeView({ node }: NodeViewProps) {
  const text = (node.attrs.text as string) || "";
  const rawColor = node.attrs.color as string;
  const colorKey: StatusColorKey = isStatusColor(rawColor) ? rawColor : "gray";
  const c = STATUS_COLORS[colorKey];
  return (
    <NodeViewWrapper as="span" className="inline-block align-middle mx-0.5">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-semibold uppercase tracking-wide leading-none"
        style={{ backgroundColor: c.bg, color: c.text }}
        contentEditable={false}
      >
        <AppIcon name="tag" size={12} alt="상태" />
        {text || "상태"}
      </span>
    </NodeViewWrapper>
  );
}
