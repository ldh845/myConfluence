"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import SpaceStarButton from "@/components/SpaceStarButton";
import type { SpaceWithPages } from "@/lib/types";

// Cycle 29 — 공간 검색. 사이드바 없는 전체 폭 페이지.
// 전체 공간을 검색 + 페이지네이션으로 탐색. ☆로 "내 공간" 추가/제거.

const PAGE_SIZE = 8;

export default function SpacesSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });

  const filtered = useMemo(() => {
    const all = spaces ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [spaces, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const enterSpace = (sp: SpaceWithPages) => {
    const first = sp.pages[0];
    if (first) router.push(`/?pageId=${first.id}`);
    else router.push(`/?spaceId=${sp.id}`);
  };

  return (
    <div className="max-w-4xl px-10 pt-8 pb-16">
      <h1 className="text-[24px] font-semibold text-[#172b4d] mb-1">
        공간 검색
      </h1>
      <p className="text-[13px] text-[#6b778c] mb-5">
        사이트의 모든 공간을 검색하고, ☆을 눌러 &lsquo;내 공간&rsquo;에
        추가하세요.
      </p>

      {/* 검색 입력 */}
      <div className="relative mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b778c] text-sm">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="공간 이름 또는 설명으로 검색..."
          className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#dfe1e6] rounded-md focus:outline-none focus:border-[#0052cc]"
        />
      </div>

      <p className="text-[12px] text-[#6b778c] mb-3">
        총 {filtered.length}개 공간
      </p>

      {!spaces ? (
        <div className="text-[13px] text-[#6b778c]">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
          {query.trim()
            ? "검색 결과가 없습니다."
            : "아직 공간이 없습니다. 상단 공간 메뉴의 ‘공간 만들기’로 추가하세요."}
        </div>
      ) : (
        <ul className="border border-[#dfe1e6] rounded-md divide-y divide-[#dfe1e6] bg-white">
          {pageItems.map((sp) => (
            <li key={sp.id} className="flex items-center">
              <button
                type="button"
                onClick={() => enterSpace(sp)}
                className="flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-[#f4f5f7]"
              >
                <div className="w-9 h-9 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold shrink-0">
                  {sp.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[#172b4d] truncate">
                    {sp.name}
                  </div>
                  {sp.description && (
                    <div className="text-[12px] text-[#6b778c] truncate">
                      {sp.description}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-[#6b778c] shrink-0">
                  페이지 {sp.pages.length}개
                </span>
              </button>
              <div className="px-3">
                <SpaceStarButton spaceId={sp.id} size="md" alwaysVisible />
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="px-3 py-1 text-[13px] border border-[#dfe1e6] rounded disabled:opacity-50 hover:bg-[#ebecf0]"
          >
            이전
          </button>
          <span className="text-[13px] text-[#42526e]">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-3 py-1 text-[13px] border border-[#dfe1e6] rounded disabled:opacity-50 hover:bg-[#ebecf0]"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
