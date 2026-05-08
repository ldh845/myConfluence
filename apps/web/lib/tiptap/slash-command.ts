import { Extension, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import SlashMenu, { type SlashMenuHandle } from "@/components/SlashMenu";
import {
  filterItems,
  type SlashCommandItem,
} from "@/lib/tiptap/slash-commands";

// FR-037 — 슬래시 명령어 익스텐션.
// "/" 입력 시 Suggestion 플러그인이 토큰을 추적하면서 popup을 켠다.
// 키보드는 SlashMenu에 위임, 위치는 tippy로 계산.

export const SlashCommand = Extension.create({
  name: "slashCommand",
  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: import("@tiptap/core").Editor;
          range: Range;
          props: SlashCommandItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const slashCommandSuggestion = {
  items: ({ query }: { query: string }) => filterItems(query),
  render: () => {
    let component: ReactRenderer<SlashMenuHandle> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props: {
        editor: import("@tiptap/core").Editor;
        clientRect: (() => DOMRect | null) | null;
      }) => {
        component = new ReactRenderer(SlashMenu, {
          props,
          editor: props.editor,
        });
        if (!props.clientRect) return;
        popup = tippy("body", {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },
      onUpdate: (props: {
        clientRect: (() => DOMRect | null) | null;
      }) => {
        component?.updateProps(props);
        if (!props.clientRect || !popup) return;
        popup[0].setProps({
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
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
};
