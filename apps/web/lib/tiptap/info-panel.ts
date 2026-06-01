import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import InfoPanelNodeView from "@/components/InfoPanelNodeView";

// Cycle 85 — Confluence 식 정보(info) 패널 매크로. 블록 컨테이너 노드.
//   attrs: title(선택), showIcon. 본문은 일반 블록 콘텐츠.
export const InfoPanelNode = Node.create({
  name: "infoPanel",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      title: { default: "" },
      showIcon: { default: true },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-info-panel]",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          return {
            title: node.getAttribute("data-title") ?? "",
            showIcon: node.getAttribute("data-show-icon") !== "false",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-info-panel": "",
        "data-title": String(node.attrs.title ?? ""),
        "data-show-icon": String(node.attrs.showIcon ?? true),
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InfoPanelNodeView);
  },

  // Cycle 85 followup 2 — 패널의 마지막 leaf 끝에서 ArrowRight → 패널 밖으로 탈출.
  //   다음 노드가 없으면 빈 paragraph 삽입 후 진입(코드 블록 followup 과 동일 패턴).
  addKeyboardShortcuts() {
    return {
      ArrowRight: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const $from = selection.$from;
        // 패널 조상 깊이 찾기
        let panelDepth = -1;
        for (let d = $from.depth - 1; d >= 0; d--) {
          if ($from.node(d).type.name === this.name) {
            panelDepth = d;
            break;
          }
        }
        if (panelDepth < 0) return false;
        // 마지막 leaf 끝인지: 직속 부모 끝 + 각 ancestor 가 마지막 자식
        if ($from.parentOffset !== $from.parent.content.size) return false;
        for (let d = $from.depth; d > panelDepth; d--) {
          const parent = $from.node(d - 1);
          const idx = $from.index(d - 1);
          if (idx !== parent.childCount - 1) return false;
        }
        // 탈출: 패널 뒤로 이동(필요 시 빈 paragraph 삽입)
        const panel = $from.node(panelDepth);
        const panelStart = $from.before(panelDepth);
        const after = panelStart + panel.nodeSize;
        if (after >= state.doc.content.size) {
          editor
            .chain()
            .insertContentAt(after, [{ type: "paragraph" }])
            .setTextSelection(after + 1)
            .run();
        } else {
          editor.commands.setTextSelection(after + 1);
        }
        return true;
      },
    };
  },
});
