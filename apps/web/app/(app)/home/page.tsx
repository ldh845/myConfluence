"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

// Cycle 29 — 시스템 홈. SystemSidebar의 sub-item 클릭으로 view 전환.
// /home?view=updates|recent|visited|saved (default: updates)
// 한 번에 하나의 view만 표시.

type ViewId = "updates" | "recent" | "visited" | "saved";
const DEFAULT_VIEW: ViewId = "updates";
const KNOWN_VIEWS: readonly ViewId[] = ["updates", "recent", "visited", "saved"];

const VIEW_TITLES: Record<ViewId, string> = {
  updates: "모든 변경사항",
  recent: "최근 작업",
  visited: "최근 방문",
  saved: "나중을 위해 저장",
};

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

// ── 시간대 분류 (최근 작업 / 최근 방문 공용) ───────────────────────────
// 한 달 이내 이력만 노출. 그보다 오래된 것은 null → 제외.
type TimeBucket = "today" | "yesterday" | "week" | "month";

const BUCKET_LABELS: Record<TimeBucket, string> = {
  today: "오늘",
  yesterday: "어제",
  week: "지난 주",
  month: "지난 달",
};

const BUCKET_ORDER: readonly TimeBucket[] = [
  "today",
  "yesterday",
  "week",
  "month",
];

function bucketOf(iso: string): TimeBucket | null {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(startOfToday);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (d >= startOfToday) return "today";
  if (d >= startOfYesterday) return "yesterday";
  if (d >= sevenDaysAgo) return "week";
  if (d >= thirtyDaysAgo) return "month";
  return null;
}

function groupByBucket<T>(
  items: T[],
  getDate: (item: T) => string,
): Record<TimeBucket, T[]> {
  const groups: Record<TimeBucket, T[]> = {
    today: [],
    yesterday: [],
    week: [],
    month: [],
  };
  for (const item of items) {
    const b = bucketOf(getDate(item));
    if (b) groups[b].push(item);
  }
  return groups;
}

function BucketHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[14px] font-semibold text-[#42526e] mt-5 mb-2 first:mt-0">
      {children}
    </h2>
  );
}

function HomeContent() {
  const params = useSearchParams();
  const raw = params.get("view");
  const view: ViewId =
    raw && (KNOWN_VIEWS as readonly string[]).includes(raw)
      ? (raw as ViewId)
      : DEFAULT_VIEW;

  return (
    <div className="max-w-[880px] px-6 pt-6 pb-16">
      <h1 className="text-[22px] font-semibold text-[#172b4d] mb-5">
        {VIEW_TITLES[view]}
      </h1>
      {view === "updates" && <UpdatesView />}
      {view === "recent" && <RecentView />}
      {view === "visited" && <VisitedView />}
      {view === "saved" && <SavedView />}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-[13px] text-[#6b778c]">로딩 중...</div>}
    >
      <HomeContent />
    </Suspense>
  );
}

// ── 모든 변경사항 (default) ──────────────────────────────────────────────
function UpdatesView() {
  const { data: activities } = useQuery<{
    items: ActivityItem[];
    total: number;
  }>({
    queryKey: ["activities", { limit: 100 }],
    queryFn: async () => {
      const r = await fetch("/api/activities?limit=100");
      if (!r.ok) return { items: [], total: 0 };
      return (await r.json()) as { items: ActivityItem[]; total: number };
    },
  });

  if (!activities) {
    return <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>;
  }
  if (activities.items.length === 0) {
    return (
      <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
        아직 활동이 없습니다.
      </div>
    );
  }
  return (
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
  );
}

// ── 최근 작업 (recently edited) ────────────────────────────────────────
// 한 달 이내 이력을 오늘 / 어제 / 지난 주 / 지난 달로 분류.
function RecentView() {
  const { data: recentEdited } = useQuery<RecentApiPage[]>({
    queryKey: ["pages-recent", 50],
    queryFn: async () => {
      const r = await fetch("/api/pages/recent?limit=50");
      if (!r.ok) return [];
      return (await r.json()) as RecentApiPage[];
    },
  });

  const grouped = useMemo(
    () => groupByBucket(recentEdited ?? [], (p) => p.updatedAt),
    [recentEdited],
  );

  if (!recentEdited) {
    return <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>;
  }

  const hasAny = BUCKET_ORDER.some((b) => grouped[b].length > 0);
  if (!hasAny) {
    return (
      <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
        최근 한 달 내 편집한 페이지가 없습니다.
      </div>
    );
  }
  return (
    <>
      {BUCKET_ORDER.map((bucket) => {
        const items = grouped[bucket];
        if (items.length === 0) return null;
        return (
          <section key={bucket}>
            <BucketHeading>{BUCKET_LABELS[bucket]}</BucketHeading>
            <div className="space-y-2">
              {items.map((p) => (
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
          </section>
        );
      })}
      <p className="text-[11px] text-[#6b778c] mt-4">
        * 인증 도입 후 &lsquo;내가 편집한 페이지&rsquo;로 정밀화 예정.
      </p>
    </>
  );
}

// ── 최근 방문 ──────────────────────────────────────────────────────────
function VisitedView() {
  const recentEntries = useRecentPagesStore((s) => s.entries);

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });

  const pageLookup = useMemo(() => {
    const map = new Map<string, { page: PageNode; space: SpaceWithPages }>();
    for (const sp of spaces ?? []) {
      for (const p of sp.pages) map.set(p.id, { page: p, space: sp });
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
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [recentEntries, pageLookup]);

  const grouped = useMemo(
    () => groupByBucket(recentVisited, (p) => p.visitedAt),
    [recentVisited],
  );

  const hasAny = BUCKET_ORDER.some((b) => grouped[b].length > 0);
  if (!hasAny) {
    return (
      <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
        최근 한 달 내 방문한 페이지가 없습니다.
      </div>
    );
  }
  return (
    <>
      {BUCKET_ORDER.map((bucket) => {
        const items = grouped[bucket];
        if (items.length === 0) return null;
        return (
          <section key={bucket}>
            <BucketHeading>{BUCKET_LABELS[bucket]}</BucketHeading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((p) => (
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
          </section>
        );
      })}
    </>
  );
}

// ── 나중을 위해 저장 (페이지 즐겨찾기) ─────────────────────────────────
function SavedView() {
  const favIds = useFavoritesStore((s) => s.ids);

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });

  const pageLookup = useMemo(() => {
    const map = new Map<string, { page: PageNode; space: SpaceWithPages }>();
    for (const sp of spaces ?? []) {
      for (const p of sp.pages) map.set(p.id, { page: p, space: sp });
    }
    return map;
  }, [spaces]);

  const favorites = useMemo(() => {
    return favIds
      .map((id) => {
        const m = pageLookup.get(id);
        if (!m) return null;
        return { id: m.page.id, title: m.page.title, spaceName: m.space.name };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [favIds, pageLookup]);

  if (favorites.length === 0) {
    return (
      <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
        별 표시한 페이지가 없습니다. 페이지 우측 ☆을 클릭해 추가하세요.
      </div>
    );
  }
  return (
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
  );
}
