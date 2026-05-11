"use client";

import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import type { ChangeEvent } from "react";

// FR-030 (Cycle 9-1b) — TaskItem React NodeView.
// editor.editable과 무관하게 input checkbox는 React가 직접 컨트롤하므로
// 조회 모드에서도 체크/해제가 가능하다. updateAttributes는 ProseMirror
// transaction을 거쳐 Y.Doc에 반영되고, autosave effect가 PATCH로 영속화.
//
// li[data-checked] 셀렉터 + li > div 셀렉터는 globals.css의 9-1 규칙과
// 그대로 호환되므로 별도 CSS 변경 불필요.
export default function TaskItemNodeView({
  node,
  updateAttributes,
}: NodeViewProps) {
  const checked = !!node.attrs.checked;
  const onToggle = (e: ChangeEvent<HTMLInputElement>) => {
    updateAttributes({ checked: e.target.checked });
  };

  return (
    <NodeViewWrapper
      as="li"
      data-type="taskItem"
      data-checked={checked ? "true" : "false"}
    >
      <label contentEditable={false} style={{ userSelect: "none" }}>
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </label>
      <NodeViewContent as="div" />
    </NodeViewWrapper>
  );
}
