import type { Editor, Range } from "@tiptap/core";

// FR-037 — 슬래시 명령어 카탈로그.
// 각 command는 슬래시 토큰("/...")을 먼저 지운 뒤(deleteRange) 해당 노드를
// 삽입한다. searchTerms는 한국어 입력 외에 영어로도 필터링되도록 보강.
export type SlashCommandItem = {
  title: string;
  description: string;
  searchTerms: string[];
  command: (ctx: { editor: Editor; range: Range }) => void;
};

export const SLASH_ITEMS: SlashCommandItem[] = [
  {
    title: "제목 1",
    description: "큰 섹션 제목",
    searchTerms: ["h1", "heading", "title", "제목"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run(),
  },
  {
    title: "제목 2",
    description: "중간 섹션 제목",
    searchTerms: ["h2", "heading", "제목"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run(),
  },
  {
    title: "제목 3",
    description: "소제목",
    searchTerms: ["h3", "heading", "제목"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run(),
  },
  {
    title: "제목 4",
    description: "소단원 제목",
    searchTerms: ["h4", "heading", "title", "제목"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 4 })
        .run(),
  },
  {
    title: "불릿 리스트",
    description: "• 항목 목록",
    searchTerms: ["bullet", "ul", "list", "리스트", "목록"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "번호 리스트",
    description: "1. 순서 있는 목록",
    searchTerms: ["number", "ordered", "ol", "리스트", "목록", "번호"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "체크리스트",
    description: "할 일 목록",
    searchTerms: ["checklist", "todo", "task", "체크", "할일", "할 일"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "인용문",
    description: "Blockquote",
    searchTerms: ["quote", "blockquote", "인용"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "코드 블록",
    description: "구문 강조 코드 블록",
    searchTerms: ["code", "codeblock", "코드"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "표 (3x3)",
    description: "헤더 행 포함 3x3 표",
    searchTerms: ["table", "표", "테이블"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    // FR-033 (Cycle 12-2) — 외부 URL 이미지 삽입. 첨부 업로드는 12-1 드롭/붙여넣기 흐름.
    title: "이미지",
    description: "외부 URL 이미지 삽입",
    searchTerms: ["image", "img", "picture", "이미지", "사진", "그림"],
    command: ({ editor, range }) => {
      const url = window.prompt("이미지 URL");
      editor.chain().focus().deleteRange(range).run();
      if (!url) return;
      const alt = window.prompt("이미지 캡션(alt 텍스트, 선택)", "") ?? "";
      editor.chain().focus().setImage({ src: url, alt }).run();
    },
  },
  {
    // FR-040 (Cycle 20) — LaTeX 수식 블록 삽입 (빈 latex → 자동 편집 모드).
    title: "수식",
    description: "LaTeX 수식 블록",
    searchTerms: ["math", "latex", "katex", "수식", "공식"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "mathBlock", attrs: { latex: "" } })
        .run();
    },
  },
  {
    title: "구분선",
    description: "수평 구분선",
    searchTerms: ["hr", "divider", "separator", "구분선", "수평선"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "링크",
    description: "선택 위치에 링크 삽입",
    searchTerms: ["link", "url", "링크"],
    command: ({ editor, range }) => {
      const url = window.prompt("링크 URL:", "https://");
      if (!url) {
        editor.chain().focus().deleteRange(range).run();
        return;
      }
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "text",
          text: url,
          marks: [{ type: "link", attrs: { href: url } }],
        })
        .run();
    },
  },
];

export function filterItems(query: string): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((item) => {
    if (item.title.toLowerCase().includes(q)) return true;
    return item.searchTerms.some((t) => t.toLowerCase().includes(q));
  });
}
