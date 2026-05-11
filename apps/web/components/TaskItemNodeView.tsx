"use client";

import { useState, type ChangeEvent } from "react";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { usePageStore } from "@/lib/stores/usePageStore";

// FR-030 (Cycle 9-1b + 10-2b-2) — TaskItem React NodeView.
// editor.editable과 무관하게 input checkbox는 React가 직접 컨트롤하므로
// 조회 모드에서도 체크/해제가 가능하다.
//
// 모드별 영속화:
//  - 편집 모드: updateAttributes → Y.Doc → 자동저장(draft) → 발행 버튼으로 승격
//  - 조회 모드(10-2b-2): updateAttributes → 즉시 PATCH /draft + POST /publish
//    한 줄 토글 = 한 번의 발행. 본문 텍스트의 미발행 draft도 함께 승격되는
//    한계는 추후 분리 endpoint로 정밀화.
export default function TaskItemNodeView({
  node,
  updateAttributes,
  editor,
}: NodeViewProps) {
  const checked = !!node.attrs.checked;
  const [pending, setPending] = useState(false);
  const pageId = usePageStore((s) => s.pageId);
  const authorName = usePageStore((s) => s.authorName);

  const onToggle = async (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    updateAttributes({ checked: next });

    // 편집 모드는 기존 자동저장이 처리. 조회 모드만 즉시 발행.
    if (editor.isEditable || !pageId) return;

    setPending(true);
    try {
      // updateAttributes 직후 ProseMirror transaction이 적용되도록 한 틱 대기.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const md =
        (
          editor.storage.markdown as
            | { getMarkdown?: () => string }
            | undefined
        )?.getMarkdown?.() ?? "";

      const draftRes = await fetch(`/api/pages/${pageId}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ content: md, authorName }),
      });
      if (!draftRes.ok) throw new Error("draft failed");

      const pubRes = await fetch(`/api/pages/${pageId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ authorName }),
      });
      if (!pubRes.ok) throw new Error("publish failed");
    } catch (err) {
      console.error("[TaskItemNodeView] immediate publish failed", err);
      updateAttributes({ checked: !next });
      window.alert("저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <NodeViewWrapper
      as="li"
      data-type="taskItem"
      data-checked={checked ? "true" : "false"}
    >
      <label contentEditable={false} style={{ userSelect: "none" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={pending}
        />
      </label>
      <NodeViewContent as="div" />
    </NodeViewWrapper>
  );
}
