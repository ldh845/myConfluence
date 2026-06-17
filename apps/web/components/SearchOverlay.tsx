"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { highlightText } from "@/lib/highlight";
import SpaceAvatar from "@/components/SpaceAvatar";
import { useRecentSpacesStore } from "@/lib/stores/useRecentSpacesStore";
import { getSpaceHomePageId } from "@/lib/spaceHome";
import type { SpaceWithPages } from "@/lib/types";

// Cycle 31 — Confluence Cloud 스타일 검색 오버레이.
// 좌측 "필터링 기준" 패널(드롭다운 팝오버 버튼 + 체크박스 다중선택) +
// 우측 결과 리스트(스페이스 + 페이지). TopNav 검색창 클릭 또는 Ctrl/Cmd+K 로 열림.

type SearchResult = {
  id: string;
  title: string;
  spaceId: string;
  parentId: string | null;
  updatedAt: string;
  author: { id: string; name: string; department: string } | null;
  snippet: string;
};

type UserOption = { id: string; name: string; department: string };

type Props = {
  open: boolean;
  onClose: () => void;
};

// 결과 페이지의 parentId 체인을 따라 "스페이스 / 부모 / ..." breadcrumb 생성.
function buildBreadcrumb(
  result: SearchResult,
  spaces: SpaceWithPages[],
): string {
  const space = spaces.find((s) => s.id === result.spaceId);
  const spaceName = space?.name ?? "";
  if (!space) return spaceName;
  const pageMap = new Map(space.pages.map((p) => [p.id, p]));
  const chain: string[] = [];
  let cur = result.parentId;
  let guard = 0;
  while (cur && guard < 10) {
    const p = pageMap.get(cur);
    if (!p) break;
    chain.unshift(p.title || "(제목 없음)");
    cur = p.parentId;
    guard++;
  }
  const parts = [spaceName, ...chain];
  if (parts.length > 3) {
    return `${parts[0]} / ... / ${parts[parts.length - 1]}`;
  }
  return parts.join(" / ");
}

// 드롭다운 팝오버 필터 버튼. 클릭 시 버튼 바로 아래에 floating 팝오버.
function FilterButton({
  id,
  icon,
  label,
  count,
  openFilter,
  setOpenFilter,
  disabled,
  disabledHint,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  openFilter: string | null;
  setOpenFilter: (v: string | null) => void;
  disabled?: boolean;
  disabledHint?: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isOpen = openFilter === id;

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen, setOpenFilter]);

  if (disabled) {
    return (
      <div
        title={disabledHint}
        className="flex items-center gap-2 px-2.5 py-2 rounded text-[13px] text-[#a5adba] cursor-not-allowed"
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
        <span className="flex-1">{label}</span>
        <span className="text-[10px]">▾</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpenFilter(isOpen ? null : id)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-[13px] ${
          isOpen
            ? "bg-[#ebecf0] text-[#172b4d]"
            : "text-[#172b4d] hover:bg-[#f4f5f7]"
        }`}
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#0052cc] text-white text-[10px] font-semibold flex items-center justify-center">
            {count}
          </span>
        )}
        <span className="text-[10px] text-[#6b778c]">▾</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-[280px] bg-white border border-[#dfe1e6] rounded-md shadow-lg z-20 py-2">
          {children}
        </div>
      )}
    </div>
  );
}

// 체크박스 행 (스페이스/사용자 공용).
function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 px-3 py-1.5 text-[13px] cursor-pointer hover:bg-[#f4f5f7]">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="flex-1 min-w-0 flex items-center gap-2">{children}</span>
    </label>
  );
}

export default function SearchOverlay({ open, onClose }: Props) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [spaceFilterQuery, setSpaceFilterQuery] = useState("");
  const [userFilterQuery, setUserFilterQuery] = useState("");

  const recentSpaceEntries = useRecentSpacesStore((s) => s.entries);

  // 열릴 때마다 초기화.
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQ("");
      setSelectedSpaceIds([]);
      setSelectedAuthorIds([]);
      setDateFrom("");
      setDateTo("");
      setOpenFilter(null);
      setSpaceFilterQuery("");
      setUserFilterQuery("");
    }
  }, [open]);

  // 250ms debounce.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Esc 닫기.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
    enabled: open,
  });

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const r = await fetch("/api/users", { credentials: "include" });
      if (!r.ok) return [];
      return (await r.json()) as UserOption[];
    },
    enabled: open,
  });

  const { data: search, isFetching } = useQuery<{
    results: SearchResult[];
    total: number;
  }>({
    queryKey: [
      "overlay-search",
      {
        q: debouncedQ,
        spaceIds: selectedSpaceIds,
        authorIds: selectedAuthorIds,
        dateFrom,
        dateTo,
      },
    ],
    queryFn: async () => {
      const qs = new URLSearchParams({ q: debouncedQ, limit: "30" });
      if (selectedSpaceIds.length)
        qs.set("spaceIds", selectedSpaceIds.join(","));
      if (selectedAuthorIds.length)
        qs.set("authorIds", selectedAuthorIds.join(","));
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      const r = await fetch(`/api/pages/full-search?${qs.toString()}`);
      if (!r.ok) return { results: [], total: 0 };
      return (await r.json()) as { results: SearchResult[]; total: number };
    },
    enabled: open && debouncedQ.trim().length >= 1,
  });

  const pageResults = search?.results ?? [];
  const pageTotal = search?.total ?? 0;
  const allSpaces = useMemo(() => spaces ?? [], [spaces]);

  // 우측 결과의 스페이스 매칭 — 메인 검색어 ILIKE. 스페이스 필터 선택 시 생략.
  const matchedSpaces = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    if (!needle || selectedSpaceIds.length) return [];
    return allSpaces.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        (s.description ?? "").toLowerCase().includes(needle),
    );
  }, [allSpaces, debouncedQ, selectedSpaceIds]);

  const totalCount = pageTotal + matchedSpaces.length;

  // 스페이스 팝오버 — "스페이스 찾기" 결과 또는 "최근 스페이스".
  const spaceNeedle = spaceFilterQuery.trim().toLowerCase();
  const spacePopoverList = useMemo(() => {
    if (spaceNeedle) {
      return allSpaces.filter((s) =>
        s.name.toLowerCase().includes(spaceNeedle),
      );
    }
    return recentSpaceEntries
      .map((e) => allSpaces.find((s) => s.id === e.spaceId))
      .filter((s): s is SpaceWithPages => !!s)
      .slice(0, 5);
  }, [allSpaces, spaceNeedle, recentSpaceEntries]);

  // 기여자 팝오버 — 이름 매칭.
  const userNeedle = userFilterQuery.trim().toLowerCase();
  const userPopoverList = useMemo(() => {
    const list = users ?? [];
    if (!userNeedle) return list;
    return list.filter((u) => u.name.toLowerCase().includes(userNeedle));
  }, [users, userNeedle]);

  const hasActiveFilter =
    selectedSpaceIds.length > 0 ||
    selectedAuthorIds.length > 0 ||
    !!dateFrom ||
    !!dateTo;

  if (!open) return null;

  const toggleSpace = (id: string) =>
    setSelectedSpaceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleAuthor = (id: string) =>
    setSelectedAuthorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const resetFilters = () => {
    setSelectedSpaceIds([]);
    setSelectedAuthorIds([]);
    setDateFrom("");
    setDateTo("");
  };

  const openPage = (pageId: string) => {
    router.push(`/?pageId=${pageId}`);
    onClose();
  };
  const enterSpace = (sp: SpaceWithPages) => {
    // Cycle 32 — 공간의 홈(메인) 페이지로 진입.
    const homeId = getSpaceHomePageId(sp);
    router.push(homeId ? `/?pageId=${homeId}` : `/?spaceId=${sp.id}`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute right-0 top-0 h-full w-[min(1000px,85vw)] bg-white flex shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 좌측 필터링 기준 ── */}
        <aside className="w-[300px] shrink-0 border-r border-[#dfe1e6] flex flex-col">
          <div className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
            필터링 기준
          </div>
          <div className="flex-1 px-2 space-y-0.5">
            {/* 스페이스 */}
            <FilterButton
              id="space"
              icon={<img src="/icons/folder.png" alt="스페이스" className="w-4 h-4" />}
              label="스페이스"
              count={selectedSpaceIds.length}
              openFilter={openFilter}
              setOpenFilter={setOpenFilter}
            >
              <div className="px-3 pb-2">
                <input
                  type="text"
                  value={spaceFilterQuery}
                  onChange={(e) => setSpaceFilterQuery(e.target.value)}
                  placeholder="스페이스 찾기..."
                  className="w-full px-2 py-1 text-[12px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
                />
              </div>
              {!spaceNeedle && (
                <div className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
                  최근 스페이스
                </div>
              )}
              <div className="max-h-60 overflow-y-auto">
                {spacePopoverList.length === 0 ? (
                  <div className="px-3 py-1.5 text-[12px] text-[#6b778c]">
                    {spaceNeedle
                      ? "일치하는 스페이스 없음"
                      : "최근 사용한 스페이스 없음"}
                  </div>
                ) : (
                  spacePopoverList.map((s) => (
                    <CheckRow
                      key={s.id}
                      checked={selectedSpaceIds.includes(s.id)}
                      onChange={() => toggleSpace(s.id)}
                    >
                      <SpaceAvatar name={s.name} icon={s.icon} size={20} />
                      <span className="truncate">{s.name}</span>
                    </CheckRow>
                  ))
                )}
              </div>
            </FilterButton>

            {/* 기여자 */}
            <FilterButton
              id="contributor"
              icon={<img src="/icons/user.png" alt="기여자" className="w-4 h-4" />}
              label="기여자"
              count={selectedAuthorIds.length}
              openFilter={openFilter}
              setOpenFilter={setOpenFilter}
            >
              <div className="px-3 pb-2">
                <input
                  type="text"
                  value={userFilterQuery}
                  onChange={(e) => setUserFilterQuery(e.target.value)}
                  placeholder="사용자 찾기..."
                  className="w-full px-2 py-1 text-[12px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {userPopoverList.length === 0 ? (
                  <div className="px-3 py-1.5 text-[12px] text-[#6b778c]">
                    사용자 없음
                  </div>
                ) : (
                  userPopoverList.map((u) => (
                    <CheckRow
                      key={u.id}
                      checked={selectedAuthorIds.includes(u.id)}
                      onChange={() => toggleAuthor(u.id)}
                    >
                      <span className="truncate">
                        {u.name}
                        <span className="text-[#6b778c]">
                          {" "}
                          · {u.department}
                        </span>
                      </span>
                    </CheckRow>
                  ))
                )}
              </div>
            </FilterButton>

            {/* 날짜 */}
            <FilterButton
              id="date"
              icon={<img src="/icons/calendar.svg" alt="날짜" className="w-4 h-4" />}
              label="날짜"
              count={dateFrom || dateTo ? 1 : 0}
              openFilter={openFilter}
              setOpenFilter={setOpenFilter}
            >
              <div className="px-3 py-1 space-y-2">
                <label className="block text-[12px] text-[#6b778c]">
                  시작일
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="mt-0.5 w-full px-2 py-1 text-[12px] border border-[#dfe1e6] rounded"
                  />
                </label>
                <label className="block text-[12px] text-[#6b778c]">
                  종료일
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="mt-0.5 w-full px-2 py-1 text-[12px] border border-[#dfe1e6] rounded"
                  />
                </label>
              </div>
            </FilterButton>
          </div>

          {hasActiveFilter && (
            <div className="border-t border-[#dfe1e6] px-3 py-3">
              <button
                type="button"
                onClick={resetFilters}
                className="block text-[12px] text-[#6b778c] hover:text-[#172b4d] hover:underline"
              >
                필터 초기화
              </button>
            </div>
          )}
        </aside>

        {/* ── 우측 결과 ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="px-6 pt-5 pb-3 border-b border-[#dfe1e6]">
            <div className="flex items-center gap-3">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="검색어를 입력하세요..."
                className="flex-1 px-3 py-2 text-[15px] border border-[#dfe1e6] rounded-md focus:outline-none focus:border-[#0052cc]"
              />
              <button
                type="button"
                onClick={onClose}
                className="text-[13px] text-[#6b778c] hover:text-[#172b4d] px-2"
              >
                닫기 (Esc)
              </button>
            </div>
            {debouncedQ.trim() && (
              <div className="mt-2 text-[12px] text-[#6b778c]">
                {isFetching ? "검색 중..." : `${totalCount}개의 검색 결과`}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!debouncedQ.trim() ? (
              <div className="text-[13px] text-[#6b778c] py-12 text-center">
                검색어를 입력하세요.
              </div>
            ) : totalCount === 0 && !isFetching ? (
              <div className="text-[13px] text-[#6b778c] py-12 text-center">
                검색 결과가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {/* 스페이스 결과 */}
                {matchedSpaces.length > 0 && (
                  <ul className="space-y-1">
                    {matchedSpaces.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => enterSpace(s)}
                          className="w-full text-left flex gap-3 px-3 py-2.5 rounded-md hover:bg-[#f4f5f7]"
                        >
                          <SpaceAvatar name={s.name} icon={s.icon} size={28} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-medium text-[#172b4d] flex items-center gap-2">
                              {highlightText(s.name, debouncedQ)}
                              <span className="text-[10px] font-semibold uppercase text-[#6b778c] border border-[#dfe1e6] rounded px-1 py-0.5">
                                스페이스
                              </span>
                            </div>
                            {s.description && (
                              <div className="text-[12px] text-[#6b778c] mt-0.5 line-clamp-1">
                                {highlightText(s.description, debouncedQ)}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* 페이지 결과 */}
                {pageResults.length > 0 && (
                  <ul className="space-y-1">
                    {pageResults.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => openPage(r.id)}
                          className="w-full text-left flex gap-3 px-3 py-2.5 rounded-md hover:bg-[#f4f5f7]"
                        >
                          <div className="w-7 h-7 shrink-0 rounded bg-[#deebff] text-[#0052cc] flex items-center justify-center text-[13px]">
                            📄
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-medium text-[#172b4d]">
                              {highlightText(
                                r.title || "(제목 없음)",
                                debouncedQ,
                              )}
                            </div>
                            <div className="text-[11px] text-[#6b778c] mt-0.5">
                              {buildBreadcrumb(r, allSpaces)}
                              {" · "}
                              {new Date(r.updatedAt).toLocaleDateString(
                                "ko-KR",
                              )}
                              {r.author && <span> · {r.author.name}</span>}
                            </div>
                            {r.snippet && (
                              <div className="text-[12px] text-[#42526e] mt-1 line-clamp-2 whitespace-pre-wrap">
                                {highlightText(r.snippet, debouncedQ)}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
