"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// FR-034 (Cycle 11-1) — 링크 modal. 외부 URL + 내부 페이지 검색.
// onSelect(null)은 링크 제거. 페이지 클릭 시 href는 `/?pageId=<id>` 형식이며
// SPA 라우팅은 Cycle 11-2에서 useSearchParams로 동기화.

type SearchResult = {
  id: string;
  title: string;
  spaceId: string;
  updatedAt: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (href: string | null) => void;
  currentHref?: string;
};

export default function InternalPageLinkDialog({
  open,
  onOpenChange,
  onSelect,
  currentHref,
}: Props) {
  const [url, setUrl] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // 모달이 열릴 때 현재 링크를 외부 URL 입력에 채워 넣어 수정 흐름을 살림.
  useEffect(() => {
    if (open) {
      setUrl(currentHref ?? "");
      setQ("");
      setDebouncedQ("");
    }
  }, [open, currentHref]);

  // 250ms debounce — 외부 라이브러리 없이 setTimeout으로.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery<SearchResult[]>({
    queryKey: ["pages-search", debouncedQ],
    queryFn: async () => {
      const r = await fetch(
        `/api/pages/search?q=${encodeURIComponent(debouncedQ)}`,
      );
      if (!r.ok) return [];
      return (await r.json()) as SearchResult[];
    },
    enabled: debouncedQ.trim().length >= 1,
  });

  const applyExternal = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSelect(trimmed);
    onOpenChange(false);
  };

  const applyInternal = (pageId: string) => {
    onSelect(`/?pageId=${pageId}`);
    onOpenChange(false);
  };

  const removeLink = () => {
    onSelect(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>링크</DialogTitle>
        </DialogHeader>

        <section className="space-y-2">
          <div className="text-[12px] font-semibold text-[#42526e]">
            외부 URL
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyExternal();
                }
              }}
              placeholder="https://example.com"
              className="flex-1 px-3 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
              autoFocus
            />
            <button
              type="button"
              onClick={applyExternal}
              disabled={!url.trim()}
              className="px-3 py-1.5 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
            >
              적용
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-[12px] font-semibold text-[#42526e]">
            내부 페이지 검색
          </div>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="페이지 제목 일부 입력..."
            className="w-full px-3 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
          <div className="max-h-[280px] overflow-y-auto border border-[#dfe1e6] rounded">
            {debouncedQ.trim().length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-[#6b778c]">
                검색어를 입력하세요.
              </div>
            ) : isFetching ? (
              <div className="px-3 py-2 text-[12px] text-[#6b778c]">
                검색 중...
              </div>
            ) : !data || data.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-[#6b778c]">
                결과가 없습니다.
              </div>
            ) : (
              <ul>
                {data.map((page) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      onClick={() => applyInternal(page.id)}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#ebecf0] border-b border-[#dfe1e6] last:border-b-0"
                    >
                      <div className="text-[#172b4d] font-medium">
                        {page.title}
                      </div>
                      <div className="text-[11px] text-[#6b778c]">
                        /?pageId={page.id}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={removeLink}
            className="px-3 py-1.5 text-[12px] rounded text-[#de350b] hover:bg-[#ffebe6]"
          >
            링크 제거
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#ebecf0]"
          >
            취소
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
