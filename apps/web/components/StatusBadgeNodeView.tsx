"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  STATUS_COLORS,
  isStatusColor,
  type StatusColorKey,
} from "@/lib/tiptap/status-badge";

// Cycle 85 — 상태 매크로 NodeView. 인라인 알약(pill) 스타일.
export default function StatusBadgeNodeView({ node }: NodeViewProps) {
  const text = (node.attrs.text as string) || "";
  const rawColor = node.attrs.color as string;
  const colorKey: StatusColorKey = isStatusColor(rawColor) ? rawColor : "gray";
  const c = STATUS_COLORS[colorKey];
  return (
    <NodeViewWrapper as="span" className="inline-block align-middle mx-0.5">
      <span
        className="inline-block px-2 py-0.5 rounded-[3px] text-[11px] font-semibold uppercase tracking-wide leading-none"
        style={{ backgroundColor: c.bg, color: c.text }}
        contentEditable={false}
      >
        {text || "상태"}
      </span>
    </NodeViewWrapper>
  );
}
