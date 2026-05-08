"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { SlashCommandItem } from "@/lib/tiptap/slash-commands";

// FR-037 — TipTap Suggestion 콜백이 호출하는 popup. 부모(extension의 render)
// 가 키보드 이벤트를 위임해주므로 forwardRef + useImperativeHandle로
// onKeyDown만 외부에 노출한다.
export type SlashMenuHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

type Props = {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
};

const SlashMenu = forwardRef<SlashMenuHandle, Props>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // 항목 셋이 바뀌면 selection 첫 항목으로 reset.
    useEffect(() => setSelected(0), [items]);

    // 선택된 항목이 항상 보이도록 스크롤 동기화.
    useLayoutEffect(() => {
      const el = listRef.current?.querySelector<HTMLElement>(
        `[data-idx="${selected}"]`,
      );
      el?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: (event) => {
          if (event.key === "ArrowDown") {
            setSelected((s) => (items.length === 0 ? 0 : (s + 1) % items.length));
            return true;
          }
          if (event.key === "ArrowUp") {
            setSelected((s) =>
              items.length === 0 ? 0 : (s - 1 + items.length) % items.length,
            );
            return true;
          }
          if (event.key === "Enter") {
            const item = items[selected];
            if (item) command(item);
            return true;
          }
          return false;
        },
      }),
      [items, selected, command],
    );

    if (items.length === 0) {
      return (
        <div className="slash-menu min-w-[240px] bg-white border border-[#dfe1e6] rounded-md shadow-lg p-2 text-[13px] text-[#6b778c]">
          결과 없음
        </div>
      );
    }

    return (
      <div
        ref={listRef}
        className="slash-menu min-w-[240px] max-h-[280px] overflow-y-auto bg-white border border-[#dfe1e6] rounded-md shadow-lg py-1"
      >
        {items.map((item, i) => {
          const active = i === selected;
          return (
            <button
              key={item.title}
              data-idx={i}
              type="button"
              onMouseEnter={() => setSelected(i)}
              onClick={() => command(item)}
              className={`w-full text-left px-3 py-1.5 text-[13px] flex flex-col ${
                active
                  ? "bg-[#deebff] text-[#0052cc]"
                  : "text-[#172b4d] hover:bg-[#ebecf0]"
              }`}
            >
              <span className="font-medium">{item.title}</span>
              <span className="text-[11px] text-[#6b778c]">
                {item.description}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

SlashMenu.displayName = "SlashMenu";

export default SlashMenu;
