import type { Editor, Range } from "@tiptap/core";
import { pickDate } from "@/lib/tiptap/date";
import { useEditorUiStore } from "@/lib/stores/useEditorUiStore";
import { usePageStore } from "@/lib/stores/usePageStore";

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
    // FR-033 (Cycle 12-2) — 이미지 삽입.
    // Cycle 62 — prompt → 통합 다이얼로그(ImageInsertDialog) 와 일관화.
    //   slash 토큰만 지우고 전역 store 신호로 다이얼로그를 연다(EditorToolbar
    //   의 ImageButton 이 마운트한 다이얼로그). 첨부/URL 탭 모두 사용 가능.
    title: "이미지",
    description: "첨부 또는 웹 URL 이미지 삽입",
    searchTerms: ["image", "img", "picture", "이미지", "사진", "그림"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      useEditorUiStore.getState().openImageDialog();
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
    // Cycle 54-F / 62 — 날짜 inline atom. 네이티브 date picker 로 선택.
    title: "날짜",
    description: "달력에서 날짜 선택",
    searchTerms: ["date", "day", "calendar", "날짜", "일자", "년월일"],
    command: ({ editor, range }) => {
      // slash 토큰 먼저 제거 후 picker. picker 선택은 비동기 콜백.
      editor.chain().focus().deleteRange(range).run();
      pickDate(undefined, (iso) => {
        editor
          .chain()
          .focus()
          .insertContent({ type: "date", attrs: { date: iso } })
          .run();
      });
    },
  },
  {
    // Cycle 64 — 다이어그램(Excalidraw). 새 Diagram 엔티티 POST 생성 후
    //   본문에 diagram 노드(diagramId 참조) 삽입. 노드 클릭 시 편집 모달.
    title: "다이어그램",
    description: "Excalidraw 다이어그램 삽입",
    searchTerms: ["diagram", "draw", "excalidraw", "다이어그램", "그림판", "도형"],
    command: ({ editor, range }) => {
      const pageId = usePageStore.getState().pageId;
      editor.chain().focus().deleteRange(range).run();
      if (!pageId) {
        window.alert("페이지를 먼저 선택하세요.");
        return;
      }
      fetch(`/api/pages/${pageId}/diagrams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "새 다이어그램" }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { id: string } | null) => {
          if (!d) return;
          editor
            .chain()
            .focus()
            .insertContent({ type: "diagram", attrs: { diagramId: d.id } })
            .run();
        })
        .catch(() => {
          /* best-effort */
        });
    },
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

// 에디터 툴바(네비게이션 바)에 이미 전용 버튼/드롭다운이 있는 항목 title.
//   '더 많은 내용 삽입' 드롭다운에서는 중복이라 숨긴다. (제목→문단 스타일
//   드롭다운, 목록/표/이미지/구분선/링크→해당 툴바 버튼.) 슬래시(/) 메뉴는
//   전체 노출이 표준 UX 이므로 filterItems 는 그대로 두고 여기서만 제외한다.
//   ⚠ title 정확 일치 비교 — 카탈로그 title 을 바꾸면 이 집합도 동기화할 것.
const TOOLBAR_ITEM_TITLES = new Set<string>([
  "제목 1",
  "제목 2",
  "제목 3",
  "제목 4",
  "불릿 리스트",
  "번호 리스트",
  "체크리스트",
  "인용문",
  "표 (3x3)",
  "이미지",
  "구분선",
  "링크",
]);

// '더 많은 내용 삽입' 드롭다운 전용 — 툴바 중복 항목을 뺀 카탈로그 검색.
export function insertMoreItems(query: string): SlashCommandItem[] {
  return filterItems(query).filter(
    (item) => !TOOLBAR_ITEM_TITLES.has(item.title),
  );
}
