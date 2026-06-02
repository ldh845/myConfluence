import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { all, createLowlight } from "lowlight";
import CodeBlockNodeView from "@/components/CodeBlockNodeView";

// FR-031 — lowlight v3 인스턴스. `all`은 highlight.js의 전체 언어를 등록.
// 번들 크기를 줄이려면 createLowlight()에 일부 언어만 register하는 패턴으로
// 좁힐 수 있지만, POC 단계에선 사용자가 어떤 언어를 쓸지 모르므로 전부 켠다.
export const lowlight = createLowlight(all);

export const CodeBlockExtension = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
  // Cycle 84 followup — 코드 블록 끝에서 ArrowRight → 다음 노드로 탈출.
  //   기본 exitOnArrowDown 외에 ArrowRight 도 동일하게 처리(사용자 요청).
  //   다음 노드가 없으면 빈 paragraph 삽입 후 그쪽으로 이동.
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      ArrowRight: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const $from = selection.$from;
        if ($from.parent.type.name !== this.name) return false;
        if ($from.parentOffset !== $from.parent.content.size) return false;
        const codeBlockStart = $from.before();
        const after = codeBlockStart + $from.parent.nodeSize;
        if (after >= state.doc.content.size) {
          // 문서 끝 — 빈 paragraph 삽입 후 진입.
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
}).configure({
  lowlight,
  defaultLanguage: "plaintext",
  HTMLAttributes: { class: "cf-code-block" },
});

// 언어 선택 드롭다운에 노출할 항목. lowlight.listLanguages()는 등록된 alias까지
// 다 돌려주므로 너무 길어진다. 현실적으로 자주 쓰는 것만 골라 노출한다.
export const CODE_BLOCK_LANGUAGES = [
  "plaintext",
  "javascript",
  "typescript",
  "tsx",
  "jsx",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "kotlin",
  "swift",
  "bash",
  "shell",
  "sql",
  "json",
  "yaml",
  "xml",
  "html",
  "css",
  "scss",
  "markdown",
] as const;
