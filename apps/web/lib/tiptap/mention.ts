import { Node, mergeAttributes } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import MentionSuggestionPopup, {
  type MentionUser,
  type MentionPopupHandle,
} from "@/components/MentionSuggestionPopup";

// Suggestion 의 기본 pluginKey('suggestion$') 가 slash-command 와 충돌하므로
// (한 editor 에 같은 key 인스턴스 두 개 → RangeError) 고유 키 명시 필요.
const mentionPluginKey = new PluginKey("mentionSuggestion");

// Cycle 55 — @user 멘션. @tiptap/extension-mention 은 core 2.x 와 suggestion
// 3.x 사이 peer conflict 가 있어 직접 Node + Suggestion plugin 으로 구현
// (slash-command.ts 와 동일 패턴). 새 패키지 추가 없음.
//
// 노드 모양: <span class="cf-mention" data-id="...">@name</span> (inline atom).
// markdown 직렬화는 텍스트(@name)만 — html=false 정책상 라운드트립 손실 가능
// (CLAUDE.md '마크다운 직렬화 한계' 동일 범주).
// 향후 알림(Notification) 사이클에서 멘션 transaction → POST /notifications.

type MentionAttrs = { id: string; label: string };

export const MentionNode = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-id") ?? "",
        renderHTML: (attrs: MentionAttrs) => ({ "data-id": attrs.id }),
      },
      label: {
        default: "",
        parseHTML: (el: HTMLElement) =>
          (el.textContent ?? "").replace(/^@/, ""),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span.cf-mention[data-id]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const label = (node.attrs as MentionAttrs).label || "";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "cf-mention",
        // 시각화는 NodeView 없이 inline style 로도 즉시 적용 (cf-mention 클래스
        // 가 globals.css 에 없어도).
        style:
          "display:inline-block;padding:0 4px;border-radius:3px;background:#deebff;color:#0747a6;font-size:0.95em;",
      }),
      `@${label}`,
    ];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: mentionPluginKey,
        char: "@",
        startOfLine: false,
        // GET /api/users?q=... 검색. 250ms 사이즈는 사용자가 빠르게 입력해도
        // suggestion 이 매 키스트로크마다 fetch 하지 않도록 자체 작은 캐시도
        // 검토 가능하지만 일단 단순 fetch.
        items: async ({ query }: { query: string }) => {
          const url = query
            ? `/api/users?q=${encodeURIComponent(query)}`
            : `/api/users`;
          try {
            const r = await fetch(url, { credentials: "include" });
            if (!r.ok) return [];
            const data = (await r.json()) as MentionUser[];
            return data.slice(0, 10);
          } catch {
            return [];
          }
        },
        command: ({
          editor,
          range,
          props,
        }: {
          editor: import("@tiptap/core").Editor;
          range: { from: number; to: number };
          props: MentionUser;
        }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: "mention",
                attrs: { id: props.id, label: props.name },
              },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: () => {
          let component: ReactRenderer<MentionPopupHandle> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: {
              editor: import("@tiptap/core").Editor;
              clientRect?: (() => DOMRect | null) | null;
            }) => {
              component = new ReactRenderer(MentionSuggestionPopup, {
                props,
                editor: props.editor,
              });
              if (!props.clientRect) return;
              popup = tippy("body", {
                getReferenceClientRect: () =>
                  props.clientRect?.() ?? new DOMRect(),
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },
            onUpdate: (props: {
              clientRect?: (() => DOMRect | null) | null;
            }) => {
              component?.updateProps(props);
              if (!props.clientRect || !popup) return;
              popup[0].setProps({
                getReferenceClientRect: () =>
                  props.clientRect?.() ?? new DOMRect(),
              });
            },
            onKeyDown: (props: { event: KeyboardEvent }) => {
              if (props.event.key === "Escape") {
                popup?.[0].hide();
                return true;
              }
              return component?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              popup?.[0].destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },

  // markdown 직렬화: 텍스트(@name) 만 — html=false 정책. parse 는 자동 X.
  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void }, node: { attrs: MentionAttrs }) {
          state.write(`@${node.attrs.label}`);
        },
        parse: {},
      },
    };
  },
});
