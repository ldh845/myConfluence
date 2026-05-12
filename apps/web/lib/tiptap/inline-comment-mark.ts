import { Mark } from "@tiptap/core";

// FR-071 (Cycle 16-3b-1) — 인라인 댓글 마크.
// data-comment-id 속성에 Comment row의 id를 저장. CSS 셀렉터 .cf-inline-comment로
// 노란 하이라이트. 사이드패널 / resolve UI는 16-3b-2에서 마크의 click 이벤트를 활용.
//
// 한계: tiptap-markdown은 사용자 정의 mark를 표준 markdown으로 직렬화하지 못해
// 자동저장 → Markdown 변환 후엔 마크가 사라진다. DB의 Comment 행은 영속 보존되며,
// 16-3b-2 사이드패널이 anchorJson 기반 fallback으로 가시성을 보장.
export const InlineCommentMark = Mark.create({
  name: "inlineComment",

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs: { commentId?: string | null }) =>
          attrs.commentId
            ? { "data-comment-id": attrs.commentId }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      { ...HTMLAttributes, class: "cf-inline-comment" },
      0,
    ];
  },
});
