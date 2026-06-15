"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useRecentPagesStore } from "@/lib/stores/useRecentPagesStore";
import PageCard from "@/components/PageCard";
import type { SpaceWithPages, PageNode, PageStatus } from "@/lib/types";
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
  // Cycle 70 — 카드 배지용 작업 상태.
  status?: PageStatus | null;
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

// Cycle 50 followup — 사용자 피드백 반영, 노출 범위를 사용자 생성 행위 2종으로
// 더 좁힘. page.published(편집·발행) / page.moved / page.copied 는 organize·시스템
// 성격 노이즈로 느껴진다는 피드백 → 제외. /activity 는 무수정(전체 노출 유지).
// 데이터·새 type 추가 없이 표시 단계 필터링만(GET /activities?types=...).
const HOME_ACTIVITY_TYPES = [
  "page.created",
  "comment.created",
  // Cycle 70 — 페이지 상태 변경도 사용자 활동 피드에 노출.
  "page.status_changed",
] as const;

// ── 모든 변경사항 (default) — 사용자별 그룹화 + 페이지네이션 ─────────────
const UPDATES_PAGE_SIZE = 10; // 한 페이지에 표시할 activity 개수

type UserActivityGroup = {
  actorName: string;
  actorId: string | null;
  items: ActivityItem[];
  latestAt: string;
};

type PageActivityGroup = {
  actorName: string;
  actorId: string | null;
  pages: Array<{
    pageId: string | null;
    title: string;
    actions: string[];
    latestAt: string;
    spaceName: string | null;
  }>;
  count: number;
  latestAt: string;
};

function UpdatesView() {
  const params = useSearchParams();
  const router = useRouter();
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * UPDATES_PAGE_SIZE;

  const typesParam = HOME_ACTIVITY_TYPES.join(",");
  const { data: activities, isLoading } = useQuery<{
    items: ActivityItem[];
    total: number;
  }>({
    queryKey: ["activities", { limit: UPDATES_PAGE_SIZE, offset, types: typesParam }],
    queryFn: async () => {
      const qs = new URLSearchParams({
        limit: String(UPDATES_PAGE_SIZE),
        offset: String(offset),
        types: typesParam,
      });
      const r = await fetch(`/api/activities?${qs.toString()}`);
      if (!r.ok) return { items: [], total: 0 };
      return (await r.json()) as { items: ActivityItem[]; total: number };
    },
  });

  const total = activities?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / UPDATES_PAGE_SIZE));

  const goPage = (n: number) => {
    const next = Math.min(totalPages, Math.max(1, n));
    const qs = new URLSearchParams(params.toString());
    qs.set("page", String(next));
    router.push(`/home?${qs.toString()}`);
  };

  if (isLoading || !activities) {
    return <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>;
  }
  if (activities.items.length === 0) {
    return (
      <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
        아직 활동이 없습니다.
      </div>
    );
  }

  // actorName별로 그룹화 → 같은 사용자의 활동은 하나로 모음
  const actorMap = new Map<string, UserActivityGroup>();
  for (const it of activities.items) {
    const name = it.actor?.name ?? it.actorName ?? "알 수 없음";
    const key = it.actor?.id ?? name;
    let group = actorMap.get(key);
    if (!group) {
      group = { actorName: name, actorId: it.actor?.id ?? null, items: [], latestAt: it.createdAt };
      actorMap.set(key, group);
    }
    group.items.push(it);
    if (it.createdAt > group.latestAt) group.latestAt = it.createdAt;
  }

  // 각 그룹 내에서도 페이지별로 정리
  const grouped: PageActivityGroup[] = Array.from(actorMap.values())
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
    .map((g) => {
      const pageMap = new Map<string, { title: string; actions: string[]; latestAt: string; spaceName: string | null; pageId: string | null }>();
      for (const it of g.items) {
        const fmt = formatActivity(it);
        const pageKey = fmt.pageId ?? it.id;
        let p = pageMap.get(pageKey);
        if (!p) {
          p = { title: fmt.pageTitle, actions: [], latestAt: it.createdAt, spaceName: fmt.spaceName, pageId: fmt.pageId };
          pageMap.set(pageKey, p);
        }
        p.actions.push(fmt.icon);
        if (it.createdAt > p.latestAt) p.latestAt = it.createdAt;
      }
      return {
        actorName: g.actorName,
        actorId: g.actorId,
        pages: Array.from(pageMap.values()),
        count: g.items.length,
        latestAt: g.latestAt,
      };
    });

  return (
    <>
      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.actorId ?? group.actorName} className="border border-[#dfe1e6] rounded-md bg-white overflow-hidden">
            {/* 그룹 헤더 */}
            <div className="px-3 py-2 bg-[#f4f5f7] border-b border-[#dfe1e6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#0052cc] text-white flex items-center justify-center text-[11px] font-semibold shrink-0">
                  {group.actorName.charAt(0)}
                </div>
                <div>
                  <span className="text-[13px] font-semibold text-[#172b4d]">{group.actorName}</span>
                  <span className="text-[11px] text-[#6b778c] ml-1.5">
                    {group.count}건 · {relativeTime(group.latestAt)}
                  </span>
                </div>
              </div>
            </div>
            {/* 페이지 목록 */}
            <div className="divide-y divide-[#dfe1e6]">
              {group.pages.map((p) => (
                <div key={p.pageId ?? p.title} className="flex items-start gap-2 px-3 py-2 hover:bg-[#f4f5f7]">
                  <span className="text-[12px] text-[#6b778c] whitespace-nowrap">{p.actions.join("")}</span>
                  <div className="flex-1 min-w-0">
                    {p.pageId ? (
                      <Link href={`/?pageId=${p.pageId}`} className="text-[13px] text-[#0052cc] hover:underline truncate block">
                        {p.title}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-[#172b4d] truncate">{p.title}</span>
                    )}
                    <div className="text-[11px] text-[#6b778c]">
                      {p.spaceName && <span>{p.spaceName} · </span>}
                      {relativeTime(p.latestAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 페이지네이션 */}
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
    </>
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
                  status={p.status}
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

// ── 나중을 위해 저장 (저장한 페이지 목록) ─────────────────────────────
// Cycle 69 — 서버 SavedPage 가 단일 출처. 페이지 상단 ☆ 버튼이 토글하고
// 여기선 GET /api/saves 로 내 저장 목록을 읽는다(다른 기기에서도 유지).
type SavedPageItem = {
  id: string;
  title: string;
  spaceId: string;
  spaceName: string;
  // Cycle 70 — 카드 배지용 작업 상태.
  status?: PageStatus | null;
};

function SavedView() {
  const { data } = useQuery<SavedPageItem[]>({
    queryKey: ["my-saves"],
    queryFn: async () => {
      const r = await fetch("/api/saves", { credentials: "include" });
      if (!r.ok) return [];
      return (await r.json()) as SavedPageItem[];
    },
  });
  const favorites = data ?? [];

  if (favorites.length === 0) {
    return (
      <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
        저장한 페이지가 없습니다. 페이지 상단의 ☆ 버튼을 눌러 추가하세요.
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
          status={p.status}
        />
      ))}
    </div>
  );
}
