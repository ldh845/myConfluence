"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

// Cycle 29 — 시스템 홈. SystemSidebar의 anchor 대응 5개 섹션:
// #discover / #mywork / #recent / #saved / #spaces.

type RecentApiPage = {
  id: string;
  title: string;
  spaceId: string;
  updatedAt: string;
  space: { name: string };
};

function timeAgo(iso: string): string {
  const diff = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (diff < 60) return `${diff}초 전`;
  const m = Math.round(diff / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return `${d}일 전`;
}

export default function HomePage() {
  const router = useRouter();
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
    queryKey: ["pages-recent", 5],
    queryFn: async () => {
      const r = await fetch("/api/pages/recent?limit=5");
      if (!r.ok) return [];
      return (await r.json()) as RecentApiPage[];
    },
  });

  const { data: activities } = useQuery<{
    items: ActivityItem[];
    total: number;
  }>({
    queryKey: ["activities", { limit: 5 }],
    queryFn: async () => {
      const r = await fetch("/api/activities?limit=5");
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
      .slice(0, 8);
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

  const enterSpace = (sp: SpaceWithPages) => {
    const first = sp.pages[0];
    if (first) router.push(`/?pageId=${first.id}`);
    else router.push(`/?spaceId=${sp.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-[24px] font-semibold text-[#172b4d] mb-1">
        🏠 내 워크스페이스
      </h1>
      <p className="text-[13px] text-[#6b778c] mb-8">
        활동, 작업, 공간을 한곳에서 확인하세요.
      </p>

      {/* 🧭 발견 */}
      <section id="discover" className="mb-10 scroll-mt-20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold text-[#172b4d]">
            🧭 발견 — 모든 변경사항
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
          <div className="text-[12px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
            아직 활동이 없습니다.
          </div>
        ) : (
          <ul className="border border-[#dfe1e6] rounded-md divide-y divide-[#dfe1e6] bg-white">
            {activities.items.map((it) => {
              const fmt = formatActivity(it);
              const row = (
                <div className="flex items-start gap-2 px-3 py-2.5 hover:bg-[#f4f5f7]">
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
                    <Link href={`/?pageId=${fmt.pageId}`} className="block">
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

      {/* 💼 내 작업 */}
      <section id="mywork" className="mb-10 scroll-mt-20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold text-[#172b4d]">
            💼 내 작업 — 최근 편집된 페이지
          </h2>
          <p className="text-[11px] text-[#6b778c]">
            * 인증 도입 후 &lsquo;내가 편집한 페이지&rsquo;로 정밀화 예정.
          </p>
        </div>
        {!recentEdited ? (
          <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
        ) : recentEdited.length === 0 ? (
          <div className="text-[12px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
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
      </section>

      {/* 🕘 최근 방문 */}
      <section id="recent" className="mb-10 scroll-mt-20">
        <h2 className="text-[16px] font-semibold text-[#172b4d] mb-3">
          🕘 최근 방문한 페이지
        </h2>
        {recentVisited.length === 0 ? (
          <div className="text-[12px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
            아직 방문한 페이지가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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

      {/* ⭐ 나중을 위해 저장 */}
      <section id="saved" className="mb-10 scroll-mt-20">
        <h2 className="text-[16px] font-semibold text-[#172b4d] mb-3">
          ⭐ 나중을 위해 저장
        </h2>
        {favorites.length === 0 ? (
          <div className="text-[12px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
            즐겨찾기에 추가된 페이지가 없습니다. 페이지 상단의 ☆ 버튼을 눌러
            추가하세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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

      {/* 🌐 내 공간 */}
      <section id="spaces" className="mb-10 scroll-mt-20">
        <h2 className="text-[16px] font-semibold text-[#172b4d] mb-3">
          🌐 내 공간
        </h2>
        {!spaces ? (
          <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
        ) : spaces.length === 0 ? (
          <div className="text-[12px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
            아직 공간이 없습니다. 상단 TopNav의 &lsquo;공간 만들기&rsquo;를
            눌러 새 공간을 추가하세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {spaces.map((sp) => (
              <button
                key={sp.id}
                type="button"
                onClick={() => enterSpace(sp)}
                className="text-left border border-[#dfe1e6] rounded-md p-4 bg-white hover:border-[#0052cc] hover:bg-[#f4f5f7] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold shrink-0">
                    {sp.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-[#172b4d] truncate">
                      {sp.name}
                    </div>
                    {sp.description && (
                      <div className="text-[12px] text-[#6b778c] truncate mt-0.5">
                        {sp.description}
                      </div>
                    )}
                    <div className="text-[11px] text-[#6b778c] mt-1">
                      페이지 {sp.pages.length}개
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
