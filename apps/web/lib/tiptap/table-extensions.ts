// Cycle 87 — 표 노드 확장.
//   ① Table: `widthMode` attr 추가 ('responsive' | 'fixed'). 기본 'responsive'.
//      반응형 = table-layout:auto, width:auto (CSS 에서 처리). 고정폭 = 기존 동작.
//   ② TableCell/TableHeader: `verticalAlign` attr ('top'|'middle'|'bottom' | null).
//      ProseMirror selectedCell 들에 setCellAttribute 로 적용.
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

export const TableExtended = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widthMode: {
        default: "responsive",
        parseHTML: (el) =>
          el.getAttribute("data-width-mode") === "fixed"
            ? "fixed"
            : "responsive",
        renderHTML: (attrs) => ({
          "data-width-mode": (attrs.widthMode as string) || "responsive",
        }),
      },
    };
  },
});

const verticalAlignAttr = {
  verticalAlign: {
    default: null as null | "top" | "middle" | "bottom",
    parseHTML: (el: HTMLElement) => {
      const v =
        el.getAttribute("data-vertical-align") || el.style.verticalAlign;
      return v === "top" || v === "middle" || v === "bottom" ? v : null;
    },
    renderHTML: (attrs: { verticalAlign?: string | null }) => {
      if (!attrs.verticalAlign) return {};
      return {
        "data-vertical-align": attrs.verticalAlign,
        style: `vertical-align: ${attrs.verticalAlign}`,
      };
    },
  },
};

export const TableCellExtended = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...verticalAlignAttr,
    };
  },
});

export const TableHeaderExtended = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...verticalAlignAttr,
    };
  },
});
