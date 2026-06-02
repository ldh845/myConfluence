"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// Cycle 55 — @ 멘션 suggestion popup. SlashMenu 와 동일 패턴 (forwardRef +
// useImperativeHandle 로 onKeyDown 외부 위임). 부모(tippy) 가 키보드 이벤트를
// 흘려준다.

export type MentionUser = {
  id: string;
  name: string;
  department: string;
};

export type MentionPopupHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

type Props = {
  items: MentionUser[];
  command: (item: MentionUser) => void;
};

const MentionSuggestionPopup = forwardRef<MentionPopupHandle, Props>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => setSelected(0), [items]);

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
          // Cycle 85 followup — 일치 사용자가 없으면 멘션 팝업이 ArrowUp/Down/Enter
          //   를 가로채지 않고 에디터가 일반 동작(커서 이동 / 줄바꿈)을 하도록.
          if (items.length === 0) return false;
          if (event.key === "ArrowDown") {
            setSelected((s) => (s + 1) % items.length);
            return true;
          }
          if (event.key === "ArrowUp") {
            setSelected((s) => (s - 1 + items.length) % items.length);
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
        <div className="mention-popup min-w-[200px] bg-white border border-[#dfe1e6] rounded-md shadow-lg p-2 text-[12px] text-[#6b778c]">
          일치하는 사용자가 없습니다
        </div>
      );
    }

    return (
      <div
        ref={listRef}
        className="mention-popup min-w-[240px] max-h-[260px] overflow-y-auto bg-white border border-[#dfe1e6] rounded-md shadow-lg py-1"
      >
        {items.map((item, i) => {
          const active = i === selected;
          return (
            <button
              key={item.id}
              data-idx={i}
              type="button"
              onMouseEnter={() => setSelected(i)}
              onClick={() => command(item)}
              className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${
                active
                  ? "bg-[#deebff] text-[#0052cc]"
                  : "text-[#172b4d] hover:bg-[#ebecf0]"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-[#0052cc] text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                {item.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1 min-w-0">
                <span className="font-medium block truncate">{item.name}</span>
                {item.department && (
                  <span className="text-[11px] text-[#6b778c] block truncate">
                    {item.department}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

MentionSuggestionPopup.displayName = "MentionSuggestionPopup";

export default MentionSuggestionPopup;
