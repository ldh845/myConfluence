"use client";

import { useState } from "react";
import UserSearchCombobox from "./UserSearchCombobox";

// Cycle 73 — 보드 사용자 필터 칩 바. 선택 사용자(작성자/편집자) 칩 + '나' 빠른
//   추가 + '+ 사용자 추가'(검색 콤보박스). 다중 선택 OR. URL 동기화는 부모(KanbanBoard).
type U = { id: string; name: string };

export default function UserFilterChips({
  selected,
  currentUser,
  onChange,
}: {
  selected: U[];
  currentUser: U | null;
  onChange: (next: U[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ids = selected.map((u) => u.id);

  const add = (u: U) => {
    if (!ids.includes(u.id)) onChange([...selected, u]);
    setOpen(false);
  };
  const remove = (id: string) => onChange(selected.filter((u) => u.id !== id));

  const meAdded = currentUser ? ids.includes(currentUser.id) : true;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12px] text-[#6b778c] mr-0.5">작성자/편집자</span>
      {selected.map((u) => (
        <span
          key={u.id}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-[12px] bg-[#deebff] text-[#0052cc] border border-[#0052cc]"
        >
          {u.name}
          <button
            type="button"
            onClick={() => remove(u.id)}
            className="px-1 leading-none hover:text-[#172b4d]"
            aria-label={`${u.name} 필터 해제`}
          >
            ×
          </button>
        </span>
      ))}
      {currentUser && !meAdded && (
        <button
          type="button"
          onClick={() => add(currentUser)}
          className="px-2 py-1 rounded-full text-[12px] border border-[#dfe1e6] text-[#42526e] hover:bg-[#f4f5f7]"
        >
          + 나
        </button>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-2 py-1 rounded-full text-[12px] border border-dashed border-[#c1c7d0] text-[#6b778c] hover:bg-[#f4f5f7]"
        >
          + 사용자 추가
        </button>
        {open && (
          <UserSearchCombobox
            onSelect={add}
            onClose={() => setOpen(false)}
            excludeIds={ids}
          />
        )}
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[12px] text-[#6b778c] hover:underline ml-1"
        >
          초기화
        </button>
      )}
    </div>
  );
}
