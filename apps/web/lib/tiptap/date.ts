import { Node, mergeAttributes } from "@tiptap/core";

// Cycle 54-F — 날짜 inline atom 노드.
// Cycle 62 — prompt → 네이티브 date picker(input[type=date]) + 한국어 locale
//   표시("2026년 5월 27일"). attrs.date 는 ISO(YYYY-MM-DD) 그대로 보존,
//   화면/직렬화 텍스트만 한국어.
//   markdown 직렬화는 텍스트만 — Cycle 57 의 JSON 저장으로 라운드트립 보장됨
//   (content 가 JSON 이면 attrs.date 그대로 복원).

type DateAttrs = { date: string };

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ISO → 한국어 표시. 형식 안 맞으면 원문 그대로.
export function formatKoreanDate(iso: string | null | undefined): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso ?? "";
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

// Cycle 62 — 네이티브 date picker 를 띄우고, 선택 시 onPick(ISO) 호출.
//   화면 밖 hidden input 으로 picker 만 노출. showPicker 미지원 브라우저는
//   focus+click fallback. 취소(blur)는 cleanup 만.
export function pickDate(
  initial: string | undefined,
  onPick: (iso: string) => void,
): void {
  const input = document.createElement("input");
  input.type = "date";
  input.value = initial && ISO_RE.test(initial) ? initial : todayIso();
  input.style.position = "fixed";
  input.style.left = "0";
  input.style.top = "0";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
  document.body.appendChild(input);
  let done = false;
  const cleanup = () => {
    if (input.parentNode) input.parentNode.removeChild(input);
  };
  input.addEventListener("change", () => {
    done = true;
    const next = input.value;
    cleanup();
    if (next && ISO_RE.test(next)) onPick(next);
  });
  input.addEventListener("blur", () => {
    // change 가 먼저 발화하면 done=true. blur 만 오면(취소) cleanup.
    setTimeout(() => {
      if (!done) cleanup();
    }, 0);
  });
  const withPicker = input as HTMLInputElement & {
    showPicker?: () => void;
  };
  if (typeof withPicker.showPicker === "function") {
    withPicker.showPicker();
  } else {
    input.focus();
    input.click();
  }
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
    return [{ tag: "time[datetime]" }, { tag: "time[data-type='date']" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const text = formatKoreanDate((node.attrs as DateAttrs).date);
    return [
      "time",
      mergeAttributes(HTMLAttributes, {
        class: "cf-date-lozenge",
        "data-type": "date",
      }),
      text,
    ];
  },

  // 노드 클릭 시 date picker 로 재선택.
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const attrs = node.attrs as DateAttrs;
      const dom = document.createElement("time");
      dom.setAttribute("datetime", attrs.date);
      dom.setAttribute("data-type", "date");
      dom.className = "cf-date-lozenge";
      dom.style.display = "inline-block";
      dom.style.padding = "0 6px";
      dom.style.borderRadius = "3px";
      dom.style.background = "#deebff";
      dom.style.color = "#0747a6";
      dom.style.fontSize = "0.9em";
      dom.style.cursor = "pointer";
      dom.textContent = formatKoreanDate(attrs.date);
      dom.title = "클릭하여 날짜 수정";
      dom.addEventListener("click", (e) => {
        if (!editor.isEditable) return;
        e.preventDefault();
        pickDate(attrs.date, (next) => {
          const pos = typeof getPos === "function" ? getPos() : null;
          if (pos == null) return;
          editor
            .chain()
            .focus()
            .setNodeSelection(pos)
            .updateAttributes("date", { date: next })
            .run();
        });
      });
      return { dom };
    };
  },

  // markdown 직렬화: 한국어 텍스트만 (JSON 저장이 주 경로라 라운드트립은 JSON).
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void },
          node: { attrs: DateAttrs },
        ) {
          state.write(formatKoreanDate(node.attrs.date));
        },
        parse: {},
      },
    };
  },
});
