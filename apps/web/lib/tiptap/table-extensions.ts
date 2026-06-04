// Cycle 87 — 표 노드 확장.
//   ① Table: `widthMode` attr 추가 ('responsive' | 'fixed'). 기본 'responsive'.
//      반응형 = table-layout:auto, width:auto (CSS 에서 처리). 고정폭 = 기존 동작.
//   ② TableCell/TableHeader: `verticalAlign` attr ('top'|'middle'|'bottom' | null).
//      ProseMirror selectedCell 들에 setCellAttribute 로 적용.
//   ③ TableCell/TableHeader: `backgroundColor` attr — 셀 배경색 지정.
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

const cellStyleAttr = {
  verticalAlign: verticalAlignAttr.verticalAlign,
  backgroundColor: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => {
      const bg =
        el.getAttribute("data-background-color") ||
        el.style.backgroundColor ||
        el.style.background;
      return bg || null;
    },
    renderHTML: (attrs: { backgroundColor?: string | null }) => {
      if (!attrs.backgroundColor) return {};
      return {
        "data-background-color": attrs.backgroundColor,
        style: `background-color: ${attrs.backgroundColor}`,
      };
    },
  },
};

// renderHTML 에서 verticalAlign 과 backgroundColor 가 style 을 각각 반환하면
// 후속 attr 이 앞의 style 을 덮어쓰므로, 합쳐서 반환하는 통합 attr 팩토리.
function cellStyleAttrs() {
  return {
    verticalAlign: {
      ...verticalAlignAttr.verticalAlign,
      renderHTML: (attrs: Record<string, unknown>) => {
        const parts: string[] = [];
        const va = attrs.verticalAlign as string | null | undefined;
        if (va) parts.push(`vertical-align: ${va}`);
        const bg = attrs.backgroundColor as string | null | undefined;
        if (bg) parts.push(`background-color: ${bg}`);
        if (parts.length === 0) return {};
        return {
          "data-vertical-align": va || null,
          "data-background-color": bg || null,
          style: parts.join("; "),
        };
      },
    },
    backgroundColor: {
      default: null as string | null,
      parseHTML: (el: HTMLElement) => {
        const bg =
          el.getAttribute("data-background-color") ||
          el.style.backgroundColor ||
          el.style.background;
        return bg || null;
      },
      // verticalAlign 의 renderHTML 이 이미 합쳐서 반환하므로 여기서는 빈 객체.
      renderHTML: () => ({}),
    },
  };
}

export const TableCellExtended = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...cellStyleAttrs(),
    };
  },
});

export const TableHeaderExtended = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...cellStyleAttrs(),
    };
  },
});
