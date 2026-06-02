import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StatusBadgeNodeView from "@/components/StatusBadgeNodeView";

// Cycle 85 — Confluence 식 상태(status) 매크로. 인라인 atom 노드.
//   attrs: text(라벨), color(키). 색상 키는 STATUS_COLORS 에 정의된 6종.

export type StatusColorKey =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple";

export const STATUS_COLORS: Record<
  StatusColorKey,
  { bg: string; text: string; label: string }
> = {
  gray: { bg: "#dfe1e6", text: "#42526e", label: "회색" },
  blue: { bg: "#deebff", text: "#0052cc", label: "파랑" },
  green: { bg: "#e3fcef", text: "#006644", label: "초록" },
  yellow: { bg: "#fff7d6", text: "#7f5f01", label: "노랑" },
  red: { bg: "#ffebe6", text: "#bf2600", label: "빨강" },
  purple: { bg: "#eae6ff", text: "#403294", label: "보라" },
};

export function isStatusColor(s: string): s is StatusColorKey {
  return Object.prototype.hasOwnProperty.call(STATUS_COLORS, s);
}

export const StatusBadgeNode = Node.create({
  name: "statusBadge",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      text: { default: "" },
      color: { default: "gray" as StatusColorKey },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-status-badge]",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          const color = node.getAttribute("data-color") ?? "gray";
          return {
            text: node.getAttribute("data-text") ?? "",
            color: isStatusColor(color) ? color : "gray",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-status-badge": "",
        "data-text": String(node.attrs.text ?? ""),
        "data-color": String(node.attrs.color ?? "gray"),
      }),
      String(node.attrs.text ?? "상태"),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StatusBadgeNodeView);
  },
});
