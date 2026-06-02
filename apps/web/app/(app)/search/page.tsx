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

type Space = { id: string; name: string };

function SearchPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const pageParam = params.get("page") ?? "1";
  const page = Math.max(1, parseInt(pageParam, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  // FR-091 (Cycle 15-3) — 필터 + 정렬 (URL이 진실).
  const spaceId = params.get("spaceId") ?? "";
  const dateFrom = params.get("dateFrom") ?? "";
  const dateTo = params.get("dateTo") ?? "";
  const sort = params.get("sort") ?? "relevance";

  const { data: spaces } = useQuery<Space[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as Space[];
    },
  });

  const { data, isLoading } = useQuery<{
    results: SearchResult[];
    total: number;
  }>({
    queryKey: ["search-page", q, page, spaceId, dateFrom, dateTo, sort],
    queryFn: async () => {
      const qs = new URLSearchParams({
        q,
        limit: String(PAGE_SIZE),
        offset: String(offset),
        sort,
      });
      if (spaceId) qs.set("spaceId", spaceId);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      const r = await fetch(`/api/pages/full-search?${qs.toString()}`);
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
    const qs = new URLSearchParams(params.toString());
    qs.set("page", String(next));
    router.push(`/search?${qs.toString()}`);
  };

  const updateFilter = (key: string, value: string) => {
    const qs = new URLSearchParams(params.toString());
    if (value) qs.set(key, value);
    else qs.delete(key);
    qs.set("page", "1"); // 필터 변경 시 1페이지로 리셋
    router.push(`/search?${qs.toString()}`);
  };

  const resetFilters = () => {
    router.push(`/search?q=${encodeURIComponent(q)}&page=1`);
  };

  const filtersActive =
    !!spaceId || !!dateFrom || !!dateTo || sort !== "relevance";

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
      <p className="text-[13px] text-[#6b778c] mb-4">
        {q ? `"${q}"` : "(빈 검색어)"} — {total}건
      </p>

      {/* FR-091 (Cycle 15-3) — 필터 + 정렬 바. */}
      <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-[#f4f5f7] border border-[#dfe1e6] rounded-md text-[13px]">
        <label className="flex items-center gap-1">
          <span className="text-[#6b778c]">스페이스</span>
          <select
            value={spaceId}
            onChange={(e) => updateFilter("spaceId", e.target.value)}
            className="border border-[#dfe1e6] rounded px-2 py-1 bg-white"
          >
            <option value="">모든 스페이스</option>
            {(spaces ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[#6b778c]">수정일</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            className="border border-[#dfe1e6] rounded px-2 py-1 bg-white"
          />
          <span className="text-[#6b778c]">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            className="border border-[#dfe1e6] rounded px-2 py-1 bg-white"
          />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[#6b778c]">정렬</span>
          <select
            value={sort}
            onChange={(e) => updateFilter("sort", e.target.value)}
            className="border border-[#dfe1e6] rounded px-2 py-1 bg-white"
          >
            <option value="relevance">관련도</option>
            <option value="newest">최신순(생성)</option>
            <option value="updated">수정순</option>
          </select>
        </label>
        {filtersActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-[12px] text-[#0052cc] hover:underline ml-1"
          >
            필터 초기화
          </button>
        )}
      </div>

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
