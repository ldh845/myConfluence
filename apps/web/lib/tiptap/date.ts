import { Node, mergeAttributes } from "@tiptap/core";

// Cycle 54-F — 날짜 inline atom 노드.
//   클릭 시 prompt 로 ISO(YYYY-MM-DD) 재입력. 시각화는 색박스 1개 토큰
//   (Confluence 의 인라인 date lozenge 스타일).
//   markdown 직렬화는 plain text(YYYY-MM-DD)로만 — html=false 정책이라 raw
//   HTML 으로 라운드트립 못 함. CLAUDE.md "마크다운 직렬화 한계"와 동일한
//   범주: DB 의 markdown 에는 텍스트만 남고 노드 시각화는 새로고침 시 손실.
//   향후 입력 규칙(예: "2026-05-27" 패턴 자동 인식)으로 라운드트립 보강 가능.

type DateAttrs = { date: string };

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function promptForDate(initial?: string): string | null {
  // 빈/잘못된 입력은 null 반환 → 호출부가 삽입/수정 취소.
  const seed = initial && ISO_RE.test(initial) ? initial : todayIso();
  const v = window.prompt(
    "날짜를 입력하세요 (YYYY-MM-DD)",
    seed,
  );
  if (v === null) return null;
  const trimmed = v.trim();
  if (!ISO_RE.test(trimmed)) {
    window.alert("형식: YYYY-MM-DD (예: 2026-05-27)");
    return null;
  }
  return trimmed;
}

export const DateExtension = Node.create({
  name: "date",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      date: {
        default: "",
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("datetime") ?? el.textContent ?? "",
        renderHTML: (attrs: DateAttrs) =>
          attrs.date ? { datetime: attrs.date } : {},
      },
    };
  },

  parseHTML() {
    // <time datetime="..."> + data-date="..." 보조. 일반 time 만 있어도 채움.
    return [
      { tag: "time[datetime]" },
      { tag: "time[data-type='date']" },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const text = (node.attrs as DateAttrs).date || "";
    return [
      "time",
      mergeAttributes(HTMLAttributes, {
        class: "cf-date-lozenge",
        "data-type": "date",
      }),
      text,
    ];
  },

  // 노드 클릭 시 prompt 로 재입력.
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("time");
      const attrs = node.attrs as DateAttrs;
      dom.setAttribute("datetime", attrs.date);
      dom.setAttribute("data-type", "date");
      dom.className = "cf-date-lozenge";
      // 색박스 시각 — globals.css 에 .cf-date-lozenge 추가 없이도 인라인
      // 스타일로 즉시 동작하도록 최소 스타일을 inline 으로 보장.
      dom.style.display = "inline-block";
      dom.style.padding = "0 6px";
      dom.style.borderRadius = "3px";
      dom.style.background = "#deebff";
      dom.style.color = "#0747a6";
      dom.style.fontSize = "0.9em";
      dom.style.cursor = "pointer";
      dom.textContent = attrs.date;
      dom.title = "클릭하여 날짜 수정";
      dom.addEventListener("click", (e) => {
        if (!editor.isEditable) return;
        e.preventDefault();
        const next = promptForDate(attrs.date);
        if (next === null) return;
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos == null) return;
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .updateAttributes("date", { date: next })
          .run();
      });
      return { dom };
    };
  },

  // markdown 직렬화: 텍스트만 (라운드트립 시 노드 시각화 손실, 데이터 보존).
  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void }, node: { attrs: DateAttrs }) {
          state.write(node.attrs.date);
        },
        parse: {
          // 자동 파싱은 하지 않음 — 단순 텍스트와 구분이 모호해 false positive
          // 를 만들 수 있다. 사용자가 명시적으로 + / slash 로 삽입해야 함.
        },
      },
    };
  },
});
