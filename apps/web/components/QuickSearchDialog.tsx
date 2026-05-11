"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// FR-093 (Cycle 15-1b) — Ctrl+K 빠른 검색 popup.
// 15-1a의 /api/pages/full-search를 200ms debounce로 호출하고, 키보드 탐색
// (↑/↓/Enter/Esc) + 마우스 hover 동기화 + scrollIntoView를 함께 처리.

type SearchResult = {
  id: string;
  title: string;
  spaceId: string;
  updatedAt: string;
  snippet: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (pageId: string) => void;
};

export default function QuickSearchDialog({
  open,
  onOpenChange,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  // 200ms debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // popup이 열릴 때마다 입력/선택 초기화
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQ("");
      setSelectedIdx(0);
    }
  }, [open]);

  const { data } = useQuery<{ results: SearchResult[]; total: number }>({
    queryKey: ["quick-search", debouncedQ],
    queryFn: async () => {
      const r = await fetch(
        `/api/pages/full-search?q=${encodeURIComponent(debouncedQ)}&limit=20`,
      );
      if (!r.ok) return { results: [], total: 0 };
      return (await r.json()) as { results: SearchResult[]; total: number };
    },
    enabled: open && debouncedQ.trim().length >= 1,
  });

  const results = data?.results ?? [];

  // results가 변할 때 selectedIdx clamp
  useEffect(() => {
    if (selectedIdx >= results.length) setSelectedIdx(0);
  }, [results.length, selectedIdx]);

  // selectedIdx 변경 시 해당 항목 가시 영역으로
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIdx] as
      | HTMLElement
      | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onOpenChange(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(
        (i) => (i - 1 + results.length) % Math.max(results.length, 1),
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = results[selectedIdx];
      if (sel) handleSelect(sel.id);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <input
          autoFocus
          type="text"
          placeholder="페이지 검색... (제목·본문)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full border-b border-[#dfe1e6] px-4 py-3 text-[15px] outline-none"
        />
        <div className="max-h-[420px] overflow-y-auto">
          {debouncedQ.trim().length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-[#6b778c]">
              검색어를 입력하세요. (제목·본문 ILIKE 검색)
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-[#6b778c]">
              결과가 없습니다.
            </div>
          ) : (
            <ul ref={listRef}>
              {results.map((r, i) => (
                <li
                  key={r.id}
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => handleSelect(r.id)}
                  className={
                    "cursor-pointer px-4 py-2.5 border-b border-[#dfe1e6] last:border-b-0 " +
                    (i === selectedIdx
                      ? "bg-[#deebff]"
                      : "hover:bg-[#f4f5f7]")
                  }
                >
                  <div className="text-[14px] font-medium text-[#172b4d] truncate">
                    {r.title}
                  </div>
                  {r.snippet && (
                    <div className="text-[12px] text-[#6b778c] mt-0.5 line-clamp-2 whitespace-pre-wrap">
                      {r.snippet}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
