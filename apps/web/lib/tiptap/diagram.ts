import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import DiagramNodeView from "@/components/DiagramNodeView";

// Cycle 64 — 본문 다이어그램(Excalidraw) 노드. 별도 섹션(DiagramList) 대신
//   본문에 삽입. attrs.diagramId 로 기존 Diagram 엔티티(page.diagrams) 참조 —
//   본문 content 는 id 만 가져 가볍고, 실제 data/preview 는 diagrams API.
//   NodeView 가 GET /api/diagrams/:id 로 preview 표시 + 클릭 시 ExcalidrawEditor.
//   markdown 직렬화는 placeholder — JSON 저장(Cycle 57)이 attr 라운드트립.

type DiagramAttrs = { diagramId: string | null };

export const DiagramNode = Node.create({
  name: "diagram",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      diagramId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-diagram-id"),
        renderHTML: (attrs: DiagramAttrs) =>
          attrs.diagramId ? { "data-diagram-id": attrs.diagramId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-diagram-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "cf-diagram" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DiagramNodeView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; closeBlock: (n: unknown) => void },
          node: unknown,
        ) {
          // 본문 텍스트 export 시 placeholder. JSON 저장이 주 라운드트립 경로.
          state.write("[다이어그램]");
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});
