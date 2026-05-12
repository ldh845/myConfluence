import { Extension, InputRule } from "@tiptap/core";

// FR-036 (Cycle 13) — StarterKit이 커버하지 않는 마크다운 입력 자동 변환.
// 본 사이클은 다음 3종 보강:
//  - 체크리스트:        `[ ] ` / `[x] ` → TaskItem (TaskList 토글 + checked attr)
//  - 인라인 링크:       `[text](url) `  → text + link mark
//  - 인라인 이미지:     `![alt](url) `  → image node
//
// 모든 rule은 마지막 공백 입력이 트리거. tiptap-markdown 플러그인은 paste 시점만
// 처리하므로 타이핑 흐름 변환은 여기서 담당한다.

// 체크리스트 — 줄 처음의 "[ ] " 또는 "[x] ".
// toggleTaskList()로 현재 paragraph를 TaskItem으로 변환한 뒤 checked 갱신.
const taskListInputRule = new InputRule({
  find: /^\s*\[( |x)\]\s$/,
  handler: ({ range, match, chain }) => {
    const checked = match[1] === "x";
    chain()
      .deleteRange(range)
      .toggleTaskList()
      .updateAttributes("taskItem", { checked })
      .run();
  },
});

// 인라인 링크 — `[text](url) ` 입력 → text만 링크 mark, 뒤 공백은 plain.
const linkInputRule = new InputRule({
  find: /\[([^\]]+)\]\(([^)]+)\)\s$/,
  handler: ({ range, match, chain }) => {
    const [, text, url] = match;
    chain()
      .deleteRange(range)
      .insertContent([
        {
          type: "text",
          text,
          marks: [{ type: "link", attrs: { href: url } }],
        },
        { type: "text", text: " " },
      ])
      .run();
  },
});

// 인라인 이미지 — `![alt](url) ` 입력 → image 노드. alt 비어 있어도 허용.
const imageInputRule = new InputRule({
  find: /!\[([^\]]*)\]\(([^)]+)\)\s$/,
  handler: ({ range, match, chain }) => {
    const [, alt, src] = match;
    chain()
      .deleteRange(range)
      .setImage({ src, alt: alt || undefined })
      .run();
  },
});

// FR-040 (Cycle 20) — 인라인 수식 입력 규칙. `$x$ ` 입력 시 mathInline 노드로.
const mathInlineInputRule = new InputRule({
  find: /\$([^$\n]+?)\$\s$/,
  handler: ({ range, match, chain }) => {
    const latex = match[1].trim();
    if (!latex) return;
    chain()
      .deleteRange(range)
      .insertContent([
        { type: "mathInline", attrs: { latex } },
        { type: "text", text: " " },
      ])
      .run();
  },
});

export const MarkdownInputRules = Extension.create({
  name: "markdownInputRules",
  addInputRules() {
    return [
      // 이미지가 링크보다 먼저 — `![...](...)`가 `[...](...)`와도 매칭되기 때문.
      imageInputRule,
      linkInputRule,
      taskListInputRule,
      mathInlineInputRule,
    ];
  },
});
