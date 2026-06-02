"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// Cycle 73 — 사용자 검색 콤보박스(보드 사용자 필터용). 기존 GET /api/users?q=
//   재활용(이름/사용자명 contains). 외부클릭/Esc 로 닫힘.
type UserHit = { id: string; name: string; department?: string | null };

export default function UserSearchCombobox({
  onSelect,
  onClose,
  excludeIds = [],
}: {
  onSelect: (u: {
    id: string;
    name: string;
    department?: string | null;
  }) => void;
  onClose: () => void;
  excludeIds?: string[];
}) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const { data } = useQuery<UserHit[]>({
    queryKey: ["user-search", q],
    queryFn: async () => {
      const url = q.trim()
        ? `/api/users?q=${encodeURIComponent(q.trim())}`
        : "/api/users";
      const r = await fetch(url, { credentials: "include" });
      return r.ok ? ((await r.json()) as UserHit[]) : [];
    },
  });

  const results = (data ?? []).filter((u) => !excludeIds.includes(u.id));

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 w-[240px] bg-white border border-[#dfe1e6] rounded-md shadow-lg z-30"
    >
      <div className="p-2 border-b border-[#dfe1e6]">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름으로 검색..."
          className="w-full px-2 py-1 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
        />
      </div>
      <div className="max-h-[240px] overflow-y-auto py-1">
        {results.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-[#6b778c]">결과 없음</div>
        ) : (
          results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() =>
                onSelect({
                  id: u.id,
                  name: u.name,
                  department: u.department ?? null,
                })
              }
              className="w-full text-left px-3 py-1.5 text-[13px] text-[#172b4d] hover:bg-[#deebff] flex items-center justify-between gap-2"
            >
              <span className="truncate">{u.name}</span>
              {u.department && (
                <span className="text-[11px] text-[#6b778c] shrink-0">
                  {u.department}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
