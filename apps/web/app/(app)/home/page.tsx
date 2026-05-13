"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useFavoritesStore } from "@/lib/stores/useFavoritesStore";
import { useRecentPagesStore } from "@/lib/stores/useRecentPagesStore";
import PageCard from "@/components/PageCard";
import type { SpaceWithPages, PageNode } from "@/lib/types";
import {
  formatActivity,
  relativeTime,
  type ActivityItem,
} from "@/lib/activity-format";

// FR-130 (Cycle 22) — 홈 대시보드.
// 4개 카드: 최근 방문 / 즐겨찾기 / 최근 수정 / 알림(placeholder).

type RecentApiPage = {
  id: string;
  title: string;
  spaceId: string;
  updatedAt: string;
  space: { name: string };
};

function timeAgo(iso: string): string {
  const diff = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}초 전`;
  const m = Math.round(diff / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return `${d}일 전`;
}

export default function HomePage() {
  const recentEntries = useRecentPagesStore((s) => s.entries);
  const favIds = useFavoritesStore((s) => s.ids);

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });

  const { data: recentEdited } = useQuery<RecentApiPage[]>({
    queryKey: ["pages-recent", 10],
    queryFn: async () => {
      const r = await fetch("/api/pages/recent?limit=10");
      if (!r.ok) return [];
      return (await r.json()) as RecentApiPage[];
    },
  });

  const { data: activities } = useQuery<{
    items: ActivityItem[];
    total: number;
  }>({
    queryKey: ["activities", { limit: 8 }],
    queryFn: async () => {
      const r = await fetch("/api/activities?limit=8");
      if (!r.ok) return { items: [], total: 0 };
      return (await r.json()) as { items: ActivityItem[]; total: number };
    },
  });

  // 활성 페이지 + space 매핑 lookup
  const pageLookup = useMemo(() => {
    const map = new Map<string, { page: PageNode; space: SpaceWithPages }>();
    for (const sp of spaces ?? []) {
      for (const p of sp.pages) {
        map.set(p.id, { page: p, space: sp });
      }
    }
    return map;
  }, [spaces]);

  const recentVisited = useMemo(() => {
    return recentEntries
      .map((e) => {
        const m = pageLookup.get(e.pageId);
        if (!m) return null;
        return {
          id: m.page.id,
          title: m.page.title,
          spaceName: m.space.name,
          visitedAt: e.visitedAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .slice(0, 10);
  }, [recentEntries, pageLookup]);

  const favorites = useMemo(() => {
    return favIds
      .map((id) => {
        const m = pageLookup.get(id);
        if (!m) return null;
        return { id: m.page.id, title: m.page.title, spaceName: m.space.name };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [favIds, pageLookup]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-[12px] text-[#6b778c] hover:text-[#0052cc]">
          ‹ 메인으로
        </Link>
      </div>
      <h1 className="text-[24px] font-semibold text-[#172b4d] mb-1">🏠 홈</h1>
      <p className="text-[13px] text-[#6b778c] mb-6">
        최근 활동과 자주 보는 페이지를 한눈에 보여줍니다.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 최근 방문 */}
        <section className="border border-[#dfe1e6] rounded-md p-4 bg-white">
          <h2 className="text-[14px] font-semibold text-[#172b4d] mb-3">
            🕘 최근 방문한 페이지
          </h2>
          {recentVisited.length === 0 ? (
            <div className="text-[12px] text-[#6b778c]">
              아직 방문한 페이지가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {recentVisited.map((p) => (
                <PageCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  spaceName={p.spaceName}
                  subtitle={timeAgo(p.visitedAt)}
                  icon="🕘"
                />
              ))}
            </div>
          )}
        </section>

        {/* 즐겨찾기 */}
        <section className="border border-[#dfe1e6] rounded-md p-4 bg-white">
          <h2 className="text-[14px] font-semibold text-[#172b4d] mb-3">
            ⭐ 즐겨찾기
          </h2>
          {favorites.length === 0 ? (
            <div className="text-[12px] text-[#6b778c]">
              즐겨찾기에 추가된 페이지가 없습니다. 페이지 상단의 ☆ 버튼을 눌러
              추가하세요.
            </div>
          ) : (
            <div className="space-y-2">
              {favorites.map((p) => (
                <PageCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  spaceName={p.spaceName}
                  icon="⭐"
                />
              ))}
            </div>
          )}
        </section>

        {/* 최근 수정 */}
        <section className="border border-[#dfe1e6] rounded-md p-4 bg-white">
          <h2 className="text-[14px] font-semibold text-[#172b4d] mb-3">
            ✏️ 최근 수정된 페이지
          </h2>
          {!recentEdited ? (
            <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
          ) : recentEdited.length === 0 ? (
            <div className="text-[12px] text-[#6b778c]">
              최근 수정된 페이지가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {recentEdited.map((p) => (
                <PageCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  spaceName={p.space?.name}
                  subtitle={timeAgo(p.updatedAt)}
                  icon="✏️"
                />
              ))}
            </div>
          )}
          <p className="text-[11px] text-[#6b778c] mt-3">
            * 인증 도입 후 &lsquo;내가 편집한 페이지&rsquo;로 정밀화 예정.
          </p>
        </section>

        {/* 알림 (placeholder) */}
        <section className="border border-[#dfe1e6] rounded-md p-4 bg-[#f4f5f7]">
          <h2 className="text-[14px] font-semibold text-[#172b4d] mb-3">
            🔔 알림 요약
          </h2>
          <div className="text-[12px] text-[#6b778c]">
            알림 기능은 인증·알림 사이클 후 제공됩니다.
          </div>
        </section>

        {/* FR-131 (Cycle 24) — 최근 활동. md:col-span-2로 wide. */}
        <section className="md:col-span-2 border border-[#dfe1e6] rounded-md p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-[#172b4d]">
              📜 최근 활동
            </h2>
            <Link
              href="/activity"
              className="text-[12px] text-[#0052cc] hover:underline"
            >
              모두 보기 →
            </Link>
          </div>
          {!activities ? (
            <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
          ) : activities.items.length === 0 ? (
            <div className="text-[12px] text-[#6b778c]">
              아직 활동이 없습니다.
            </div>
          ) : (
            <ul className="space-y-2">
              {activities.items.map((it) => {
                const fmt = formatActivity(it);
                const row = (
                  <div className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-[#f4f5f7]">
                    <span className="text-[14px] leading-none mt-0.5">
                      {fmt.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-[#172b4d] truncate">
                        {fmt.text}
                      </div>
                      <div className="text-[11px] text-[#6b778c]">
                        {fmt.spaceName && <span>{fmt.spaceName} · </span>}
                        {relativeTime(it.createdAt)}
                      </div>
                    </div>
                  </div>
                );
                return (
                  <li key={it.id}>
                    {fmt.pageId ? (
                      <Link
                        href={`/?pageId=${fmt.pageId}`}
                        className="block"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
