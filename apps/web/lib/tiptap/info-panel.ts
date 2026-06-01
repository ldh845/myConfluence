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
});
