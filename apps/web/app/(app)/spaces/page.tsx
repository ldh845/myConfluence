"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SpaceStarButton from "@/components/SpaceStarButton";
import SpaceAvatar from "@/components/SpaceAvatar";
import CreateSpaceDialog from "@/components/CreateSpaceDialog";
import { useStarredSpacesStore } from "@/lib/stores/useStarredSpacesStore";
import type { SpaceWithPages } from "@/lib/types";

// Cycle 30 — 공간 디렉터리. Confluence Space Directory 패턴.
// 좌측 sub-nav (모든/사이트/개인/내/보관) + 우측 검색 + 공간 만들기 + 테이블.
// 사이드바 없는 전체 폭 페이지 ((app)/layout.tsx 가 /spaces 를 분기 처리).

type TabId = "all" | "site" | "my";

const TAB_LABELS: Record<TabId, string> = {
  all: "모든 공간",
  site: "사이트 공간",
  my: "내 공간",
};

// Cycle 78 — 비활성(준비 중)이던 '개인 공간'/'보관된 공간' 탭 제거(사용자 요청).
const TABS: { id: TabId; disabled?: boolean }[] = [
  { id: "all" },
  { id: "site" },
  { id: "my" },
];

function parseTab(raw: string | null): TabId {
  if (raw && raw in TAB_LABELS) return raw as TabId;
  return "all";
}

function TabLink({
  tab,
  current,
  disabled,
}: {
  tab: TabId;
  current: TabId;
  disabled?: boolean;
}) {
  const label = TAB_LABELS[tab];
  const active = tab === current;
  if (disabled) {
    return (
      <div
        className="px-3 py-1.5 rounded text-[13px] text-[#a5adba] cursor-not-allowed"
        title="추후 지원 예정"
      >
        {label}
      </div>
    );
  }
  return (
    <Link
      href={`/spaces?tab=${tab}`}
      replace
      className={`block px-3 py-1.5 rounded text-[13px] ${
        active
          ? "bg-[#deebff] text-[#0052cc] font-semibold"
          : "text-[#172b4d] hover:bg-[#ebecf0]"
      }`}
    >
      {label}
    </Link>
  );
}

function EmptyState({ tab, query }: { tab: TabId; query: string }) {
  let msg: string;
  if (tab === "my") {
    msg = "아직 별표한 공간이 없습니다. 각 공간의 ☆을 클릭해 추가하세요.";
  } else if (query.trim()) {
    msg = `'${query.trim()}'에 일치하는 공간이 없습니다.`;
  } else {
    msg = "공간이 없습니다. 첫 공간을 만들어보세요.";
  }
  return (
    <div className="mt-4 text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-6 text-center">
      {msg}
    </div>
  );
}

function SpacesDirectory() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const starredIds = useStarredSpacesStore((s) => s.ids);

  const tab = parseTab(params.get("tab"));
  const [q, setQ] = useState(params.get("q") ?? "");

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });

  // 검색어를 URL ?q= 에도 동기화 (새로고침 시 유지).
  const onSearchChange = (value: string) => {
    setQ(value);
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    router.replace(`/spaces?${next.toString()}`);
  };

  const filteredSpaces = useMemo(() => {
    const all = spaces ?? [];
    let base: SpaceWithPages[];
    if (tab === "my") {
      // SystemSidebar "내 공간"과 동일 — 별표한 공간 (useStarredSpacesStore).
      base = all.filter((s) => starredIds.includes(s.id));
    } else {
      // all / site — 현재 personal space 개념이 없어 동일 데이터.
      base = all;
    }
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        (s.description ?? "").toLowerCase().includes(needle),
    );
  }, [spaces, tab, q, starredIds]);

  // Cycle 80 — prompt 체인 → '공간 만들기' 모달.
  const [createOpen, setCreateOpen] = useState(false);
  const handleCreateSpace = () => setCreateOpen(true);

  const showTable = tab === "all" || tab === "site" || tab === "my";

  return (
    <div className="flex min-h-full">
      {/* 좌측 sub-nav */}
      <aside className="w-[220px] shrink-0 border-r border-[#dfe1e6] bg-white p-4">
        <h2 className="text-[20px] font-semibold text-[#172b4d] mb-4">
          공간
        </h2>
        <nav className="space-y-1">
          {TABS.map((t) => (
            <TabLink
              key={t.id}
              tab={t.id}
              current={tab}
              disabled={t.disabled}
            />
          ))}
        </nav>
      </aside>

      {/* 우측 메인 */}
      <main className="flex-1 min-w-0 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[24px] font-semibold text-[#172b4d]">
            {TAB_LABELS[tab]}
          </h1>
          <button
            type="button"
            onClick={handleCreateSpace}
            className="px-3 py-1.5 rounded bg-[#0052cc] hover:bg-[#0747a6] text-white text-[13px] font-medium"
          >
            ＋ 공간 만들기
          </button>
        </div>

        {showTable && (
          <div className="mb-4">
            <input
              type="search"
              value={q}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="공간 검색..."
              className="w-full max-w-xs px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
            />
          </div>
        )}

        {!spaces && showTable ? (
          <div className="text-[13px] text-[#6b778c]">불러오는 중...</div>
        ) : filteredSpaces.length === 0 ? (
          <EmptyState tab={tab} query={q} />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#dfe1e6] text-left text-[#6b778c] text-[12px]">
                <th className="py-2 w-12" />
                <th className="py-2">공간</th>
                <th className="py-2">설명</th>
                <th className="py-2 w-12" />
              </tr>
            </thead>
            <tbody>
              {filteredSpaces.map((space) => (
                <tr
                  key={space.id}
                  className="border-b border-[#dfe1e6] hover:bg-[#f4f5f7]"
                >
                  <td className="py-3">
                    <SpaceAvatar name={space.name} icon={space.icon} size={32} />
                  </td>
                  <td>
                    <Link
                      href={`/?spaceId=${space.id}`}
                      className="text-[#0052cc] hover:underline font-medium"
                    >
                      {space.name}
                    </Link>
                  </td>
                  <td className="text-[#6b778c]">
                    {space.description || "-"}
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center">
                      <SpaceStarButton
                        spaceId={space.id}
                        size="md"
                        alwaysVisible
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      <CreateSpaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(space) => {
          queryClient.invalidateQueries({ queryKey: ["spaces"] });
          router.push(`/?spaceId=${space.id}`);
        }}
      />
    </div>
  );
}

export default function SpacesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-[13px] text-[#6b778c]">로딩 중...</div>
      }
    >
      <SpacesDirectory />
    </Suspense>
  );
}
