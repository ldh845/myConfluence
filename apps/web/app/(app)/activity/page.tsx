"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ACTIVITY_TYPES,
  formatActivity,
  relativeTime,
  type ActivityItem,
} from "@/lib/activity-format";
import type { SpaceWithPages } from "@/lib/types";

// FR-131 (Cycle 24) — /activity 피드.
// 필터: spaceId / type / actorName. 페이지네이션(30/page). URL이 진실.

const PAGE_SIZE = 30;

function ActivityList() {
  const params = useSearchParams();
  const router = useRouter();
  const spaceId = params.get("spaceId") ?? "";
  const type = params.get("type") ?? "";
  const actorName = params.get("actorName") ?? "";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });

  const { data, isLoading } = useQuery<{
    items: ActivityItem[];
    total: number;
  }>({
    queryKey: ["activities", { spaceId, type, actorName, page }],
    queryFn: async () => {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (spaceId) qs.set("spaceId", spaceId);
      if (type) qs.set("type", type);
      if (actorName) qs.set("actorName", actorName);
      const r = await fetch(`/api/activities?${qs.toString()}`);
      if (!r.ok) return { items: [], total: 0 };
      return (await r.json()) as { items: ActivityItem[]; total: number };
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const update = (key: string, value: string) => {
    const qs = new URLSearchParams(params.toString());
    if (value) qs.set(key, value);
    else qs.delete(key);
    qs.set("page", "1");
    router.push(`/activity?${qs.toString()}`);
  };

  const goPage = (n: number) => {
    const next = Math.min(totalPages, Math.max(1, n));
    const qs = new URLSearchParams(params.toString());
    qs.set("page", String(next));
    router.push(`/activity?${qs.toString()}`);
  };

  const filtersActive = !!spaceId || !!type || !!actorName;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-[12px] text-[#6b778c] hover:text-[#0052cc]"
        >
          ‹ 메인으로
        </Link>
      </div>
      <h1 className="text-[24px] font-semibold text-[#172b4d] mb-1">
        📜 활동 피드
      </h1>
      <p className="text-[13px] text-[#6b778c] mb-5">총 {total}개 활동</p>

      <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-[#f4f5f7] border border-[#dfe1e6] rounded-md text-[13px]">
        <label className="flex items-center gap-1">
          <span className="text-[#6b778c]">스페이스</span>
          <select
            value={spaceId}
            onChange={(e) => update("spaceId", e.target.value)}
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
          <span className="text-[#6b778c]">유형</span>
          <select
            value={type}
            onChange={(e) => update("type", e.target.value)}
            className="border border-[#dfe1e6] rounded px-2 py-1 bg-white"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[#6b778c]">작성자</span>
          <input
            type="text"
            defaultValue={actorName}
            placeholder="이름 검색..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                update("actorName", (e.target as HTMLInputElement).value);
              }
            }}
            className="border border-[#dfe1e6] rounded px-2 py-1 bg-white"
          />
        </label>
        {filtersActive && (
          <button
            type="button"
            onClick={() => router.push("/activity")}
            className="text-[12px] text-[#0052cc] hover:underline ml-1"
          >
            필터 초기화
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-[13px] text-[#6b778c]">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-[13px] text-[#6b778c]">
          해당 조건의 활동이 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const fmt = formatActivity(it);
            const content = (
              <article className="border border-[#dfe1e6] rounded-md p-3 hover:border-[#0052cc] hover:bg-[#f4f5f7]">
                <div className="flex items-start gap-2">
                  <span className="text-[16px] leading-none mt-0.5">
                    {fmt.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#172b4d]">
                      {fmt.text}
                    </div>
                    <div className="text-[11px] text-[#6b778c] mt-0.5">
                      {fmt.spaceName && <span>{fmt.spaceName} · </span>}
                      {relativeTime(it.createdAt)}
                    </div>
                  </div>
                </div>
              </article>
            );
            return (
              <li key={it.id}>
                {fmt.pageId ? (
                  <Link href={`/?pageId=${fmt.pageId}`} className="block">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => goPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 text-[13px] border border-[#dfe1e6] rounded disabled:opacity-50 hover:bg-[#ebecf0]"
          >
            이전
          </button>
          <span className="text-[13px] text-[#42526e]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goPage(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 text-[13px] border border-[#dfe1e6] rounded disabled:opacity-50 hover:bg-[#ebecf0]"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-[13px] text-[#6b778c]">로딩 중...</div>}
    >
      <ActivityList />
    </Suspense>
  );
}
