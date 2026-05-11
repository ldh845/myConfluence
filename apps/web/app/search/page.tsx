"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { highlightText } from "@/lib/highlight";

// FR-090 / FR-092 (Cycle 15-2) — /search?q=...&page=N
// 15-1a의 /api/pages/full-search를 page=N → offset 매핑으로 호출.
// useSearchParams가 Suspense를 요구하므로 wrapper 분리.

type SearchResult = {
  id: string;
  title: string;
  spaceId: string;
  updatedAt: string;
  snippet: string;
};

const PAGE_SIZE = 20;

function SearchPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const pageParam = params.get("page") ?? "1";
  const page = Math.max(1, parseInt(pageParam, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { data, isLoading } = useQuery<{
    results: SearchResult[];
    total: number;
  }>({
    queryKey: ["search-page", q, page],
    queryFn: async () => {
      const r = await fetch(
        `/api/pages/full-search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${offset}`,
      );
      if (!r.ok) return { results: [], total: 0 };
      return (await r.json()) as { results: SearchResult[]; total: number };
    },
    enabled: q.trim().length >= 1,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const results = data?.results ?? [];

  const goPage = (n: number) => {
    const next = Math.min(totalPages, Math.max(1, n));
    router.push(`/search?q=${encodeURIComponent(q)}&page=${next}`);
  };

  const openResult = (pageId: string) => {
    router.push(`/?pageId=${pageId}`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <a
          href="/"
          className="text-[12px] text-[#6b778c] hover:text-[#0052cc]"
        >
          ‹ 메인으로
        </a>
      </div>
      <h1 className="text-[24px] font-semibold text-[#172b4d] mb-1">
        검색 결과
      </h1>
      <p className="text-[13px] text-[#6b778c] mb-6">
        {q ? `"${q}"` : "(빈 검색어)"} — {total}건
      </p>

      {q.trim().length === 0 ? (
        <div className="text-[13px] text-[#6b778c]">검색어를 입력하세요.</div>
      ) : isLoading ? (
        <div className="text-[13px] text-[#6b778c]">검색 중...</div>
      ) : results.length === 0 ? (
        <div className="text-[13px] text-[#6b778c]">결과가 없습니다.</div>
      ) : (
        <ul className="space-y-3">
          {results.map((r) => (
            <li
              key={r.id}
              onClick={() => openResult(r.id)}
              className="cursor-pointer border border-[#dfe1e6] rounded-md p-4 hover:border-[#0052cc] hover:bg-[#f4f5f7]"
            >
              <div className="text-[16px] font-medium text-[#172b4d]">
                {highlightText(r.title, q)}
              </div>
              {r.snippet && (
                <div className="text-[13px] text-[#42526e] mt-1 whitespace-pre-wrap">
                  {highlightText(r.snippet, q)}
                </div>
              )}
              <div className="text-[11px] text-[#6b778c] mt-2">
                {new Date(r.updatedAt).toLocaleString("ko-KR")}
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-6">
          <button
            onClick={() => goPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 text-[13px] border border-[#dfe1e6] rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#ebecf0]"
          >
            이전
          </button>
          <span className="text-[13px] text-[#42526e]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => goPage(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 text-[13px] border border-[#dfe1e6] rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#ebecf0]"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-[13px] text-[#6b778c]">로딩 중...</div>}
    >
      <SearchPageInner />
    </Suspense>
  );
}
