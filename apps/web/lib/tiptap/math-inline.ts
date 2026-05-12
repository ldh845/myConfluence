import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import MathInlineView from "@/components/MathInlineView";

// FR-040 (Cycle 20) — 인라인 LaTeX 수식. $...$ 마크다운 라운드트립.
// markdown-it inline rule을 addStorage.markdown.parse.setup에서 등록한다.

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type MathInlineAttrs = { latex: string };

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-latex") ?? "",
        renderHTML: (attrs: MathInlineAttrs) => ({
          "data-latex": attrs.latex,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span.math-inline[data-latex]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "math-inline" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },

  // tiptap-markdown 라운드트립.
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void },
          node: { attrs: MathInlineAttrs },
        ) {
          state.write(`$${node.attrs.latex}$`);
        },
        parse: {
          setup(md: {
            inline: {
              ruler: {
                before: (
                  ref: string,
                  name: string,
                  fn: (state: unknown, silent: boolean) => boolean,
                ) => void;
              };
            };
            renderer: {
              rules: Record<
                string,
                (
                  tokens: Array<{ content: string }>,
                  idx: number,
                ) => string
              >;
            };
          }) {
            md.inline.ruler.before(
              "emphasis",
              "math_inline",
              (state: unknown, silent: boolean) => {
                // ProseMirror/tiptap-markdown은 markdown-it 인스턴스를 그대로 사용.
                // state 타입 안전성을 위해 좁은 인터페이스로 캐스팅.
                const s = state as {
                  src: string;
                  pos: number;
                  push: (
                    type: string,
                    tag: string,
                    nesting: number,
                  ) => { markup: string; content: string };
                };
                if (s.src.charCodeAt(s.pos) !== 0x24 /* $ */) return false;
                // 단독 $는 무시; $$는 block에서 처리.
                if (s.src.charCodeAt(s.pos + 1) === 0x24) return false;
                const rest = s.src.slice(s.pos + 1);
                const match = rest.match(/^([^$\n]+?)\$/);
                if (!match) return false;
                if (!silent) {
                  const token = s.push("math_inline", "span", 0);
                  token.markup = "$";
                  token.content = match[1];
                }
                s.pos += match[0].length + 1;
                return true;
              },
            );
            md.renderer.rules.math_inline = (tokens, idx) =>
              `<span class="math-inline" data-latex="${escapeAttr(
                tokens[idx].content,
              )}"></span>`;
          },
        },
      },
    };
  },
});
