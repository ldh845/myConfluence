"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useFavoritesStore } from "@/lib/stores/useFavoritesStore";
import { useRecentPagesStore } from "@/lib/stores/useRecentPagesStore";
import { useStarredSpacesStore } from "@/lib/stores/useStarredSpacesStore";
import PageCard from "@/components/PageCard";
import SpaceStarButton from "@/components/SpaceStarButton";
import type { SpaceWithPages, PageNode } from "@/lib/types";
import {
  formatActivity,
  relativeTime,
  type ActivityItem,
} from "@/lib/activity-format";

// Cycle 29 — 시스템 홈. Confluence Cloud 패턴: H1 섹션 + H2 sub-섹션 스택.
// SystemSidebar의 sub-item이 anchor scroll로 매핑.

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

// scroll-margin-top: anchor scroll 시 sub-섹션이 너무 위에 붙지 않도록.
const ANCHOR_OFFSET = "scroll-mt-6";
const SECTION_OFFSET = "scroll-mt-4";

function SectionH1({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h1
      id={id}
      className={`text-[22px] font-semibold text-[#172b4d] mt-12 mb-3 ${SECTION_OFFSET}`}
    >
      {children}
    </h1>
  );
}

function SubsectionH2({
  id,
  children,
  right,
}: {
  id: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={`flex items-end justify-between mt-6 mb-3 ${ANCHOR_OFFSET}`}
    >
      <h2 className="text-[15px] font-semibold text-[#172b4d]">{children}</h2>
      {right}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const recentEntries = useRecentPagesStore((s) => s.entries);
  const favIds = useFavoritesStore((s) => s.ids);
  const starredSpaceIds = useStarredSpacesStore((s) => s.ids);

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
    <div className="max-w-[880px] mx-auto px-6 pt-6 pb-16">
      {/* ────────── 발견 ────────── */}
      <SectionH1 id="discover">발견</SectionH1>

      <SubsectionH2
        id="discover-updates"
        right={
          <Link
            href="/activity"
            className="text-[12px] text-[#0052cc] hover:underline"
          >
            모두 보기 →
          </Link>
        }
      >
        모든 변경사항
      </SubsectionH2>
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

      {/* ────────── 내 작업 ────────── */}
      <SectionH1 id="mywork">내 작업</SectionH1>

      <SubsectionH2 id="mywork-recent">최근 작업</SubsectionH2>
      {!recentEdited ? (
        <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
      ) : recentEdited.length === 0 ? (
        <div className="text-[12px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
          아직 편집한 페이지가 없습니다.
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
      <p className="text-[11px] text-[#6b778c] mt-2">
        * 인증 도입 후 &lsquo;내가 편집한 페이지&rsquo;로 정밀화 예정.
      </p>

      <SubsectionH2 id="mywork-visited">최근 방문</SubsectionH2>
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

      <SubsectionH2 id="mywork-saved">나중을 위해 저장</SubsectionH2>
      {favorites.length === 0 ? (
        <div className="text-[12px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
          별 표시한 페이지가 없습니다. 페이지 우측 ☆을 클릭해 추가하세요.
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

      {/* ────────── 내 공간 (별표한 공간만) ────────── */}
      <SectionH1 id="spaces">내 공간</SectionH1>
      <StarredSpacesGrid
        spaces={spaces ?? []}
        starredIds={starredSpaceIds}
        onEnter={enterSpace}
      />

      {/* ────────── 모든 공간 (별표 토글로 발견) ────────── */}
      <SectionH1 id="all-spaces">모든 공간</SectionH1>
      <AllSpacesGrid spaces={spaces ?? null} onEnter={enterSpace} />
    </div>
  );
}

// 별표한 스페이스만. 카드 hover 시 우상단에 ⭐(=내 공간에서 제거).
function StarredSpacesGrid({
  spaces,
  starredIds,
  onEnter,
}: {
  spaces: SpaceWithPages[];
  starredIds: string[];
  onEnter: (sp: SpaceWithPages) => void;
}) {
  const starred = spaces.filter((sp) => starredIds.includes(sp.id));
  if (starred.length === 0) {
    return (
      <div className="text-[12px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
        별표한 공간이 없습니다. 아래 &lsquo;모든 공간&rsquo;에서 ☆을 눌러
        내 공간에 추가하세요.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {starred.map((sp) => (
        <SpaceCard key={sp.id} sp={sp} onEnter={onEnter} starHoverOnly />
      ))}
    </div>
  );
}

// 모든 스페이스. 별표는 항상 보이고 클릭으로 토글.
function AllSpacesGrid({
  spaces,
  onEnter,
}: {
  spaces: SpaceWithPages[] | null;
  onEnter: (sp: SpaceWithPages) => void;
}) {
  if (!spaces) {
    return <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>;
  }
  if (spaces.length === 0) {
    return (
      <div className="text-[12px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
        가입한 공간이 없습니다.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {spaces.map((sp) => (
        <SpaceCard key={sp.id} sp={sp} onEnter={onEnter} starHoverOnly={false} />
      ))}
    </div>
  );
}

function SpaceCard({
  sp,
  onEnter,
  starHoverOnly,
}: {
  sp: SpaceWithPages;
  onEnter: (sp: SpaceWithPages) => void;
  starHoverOnly: boolean;
}) {
  // 카드 자체를 <button>이 아니라 onClick div로 두면 별표 <button>이 명실상부
  // 별개의 클릭 대상이 된다 (nested button 회피).
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEnter(sp)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEnter(sp);
        }
      }}
      className="group relative text-left border border-[#dfe1e6] rounded-md p-4 bg-white hover:border-[#0052cc] hover:bg-[#f4f5f7] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold shrink-0">
          {sp.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 pr-7">
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
      <div className="absolute top-3 right-3">
        <SpaceStarButton
          spaceId={sp.id}
          size="md"
          alwaysVisible={!starHoverOnly}
        />
      </div>
    </div>
  );
}
