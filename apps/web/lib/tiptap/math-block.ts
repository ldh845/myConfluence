import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import MathBlockView from "@/components/MathBlockView";

// FR-040 (Cycle 20) — 블록 LaTeX 수식. $$...$$ 마크다운 라운드트립.
// markdown-it block ruler에 등록.

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type MathBlockAttrs = { latex: string };

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-latex") ?? "",
        renderHTML: (attrs: MathBlockAttrs) => ({
          "data-latex": attrs.latex,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.math-block[data-latex]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "math-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (s: string) => void;
            closeBlock: (node: unknown) => void;
          },
          node: { attrs: MathBlockAttrs },
        ) {
          state.write("$$\n");
          state.write(node.attrs.latex);
          state.write("\n$$");
          state.closeBlock(node);
        },
        parse: {
          setup(md: {
            block: {
              ruler: {
                before: (
                  ref: string,
                  name: string,
                  fn: (
                    state: unknown,
                    startLine: number,
                    endLine: number,
                    silent: boolean,
                  ) => boolean,
                  options?: { alt?: string[] },
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
            md.block.ruler.before(
              "fence",
              "math_block",
              (
                state: unknown,
                startLine: number,
                endLine: number,
                silent: boolean,
              ) => {
                const s = state as {
                  bMarks: number[];
                  tShift: number[];
                  eMarks: number[];
                  src: string;
                  line: number;
                  push: (
                    type: string,
                    tag: string,
                    nesting: number,
                  ) => { content: string; markup: string; map: number[] };
                };
                const start = s.bMarks[startLine] + s.tShift[startLine];
                const max = s.eMarks[startLine];
                if (max - start < 2) return false;
                if (s.src.charCodeAt(start) !== 0x24) return false;
                if (s.src.charCodeAt(start + 1) !== 0x24) return false;
                // 닫는 $$ 라인을 찾는다.
                let nextLine = startLine + 1;
                let closed = false;
                while (nextLine < endLine) {
                  const lineStart = s.bMarks[nextLine] + s.tShift[nextLine];
                  const lineEnd = s.eMarks[nextLine];
                  const lineText = s.src.slice(lineStart, lineEnd).trim();
                  if (lineText === "$$") {
                    closed = true;
                    break;
                  }
                  nextLine++;
                }
                if (!closed) return false;
                if (silent) return true;
                const contentStart = s.bMarks[startLine + 1] ?? start + 2;
                const contentEnd = s.bMarks[nextLine] ?? max;
                const content = s.src
                  .slice(contentStart, contentEnd)
                  .replace(/\n$/, "");
                const token = s.push("math_block", "div", 0);
                token.content = content;
                token.markup = "$$";
                token.map = [startLine, nextLine + 1];
                s.line = nextLine + 1;
                return true;
              },
              { alt: ["paragraph"] },
            );
            md.renderer.rules.math_block = (tokens, idx) =>
              `<div class="math-block" data-latex="${escapeAttr(
                tokens[idx].content,
              )}"></div>`;
          },
        },
      },
    };
  },
});
