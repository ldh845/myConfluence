"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { highlightText } from "@/lib/highlight";
import { useRecentSpacesStore } from "@/lib/stores/useRecentSpacesStore";
import type { SpaceWithPages } from "@/lib/types";

// Cycle 31 — Confluence Cloud 스타일 검색 오버레이.
// 좌측 FILTER BY 패널(Space / Contributor / Date + disabled placeholders) +
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

// 접을 수 있는 필터 섹션.
function FilterSection({
  label,
  expanded,
  onToggle,
  disabled,
  disabledHint,
  children,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  disabledHint?: string;
  children?: React.ReactNode;
}) {
  if (disabled) {
    return (
      <div
        className="px-3 py-2 text-[13px] text-[#a5adba] cursor-not-allowed flex items-center justify-between"
        title={disabledHint}
      >
        <span>{label}</span>
        <span className="text-[10px]">＋</span>
      </div>
    );
  }
  return (
    <div className="border-b border-[#f0f1f3]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2 text-[13px] text-[#172b4d] hover:bg-[#f4f5f7] flex items-center justify-between"
      >
        <span className="font-medium">{label}</span>
        <span className="text-[10px] text-[#6b778c]">
          {expanded ? "▾" : "▸"}
        </span>
      </button>
      {expanded && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
}

export default function SearchOverlay({ open, onClose }: Props) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    space: true,
  });
  // FILTER BY > Space 섹션 안의 "스페이스 찾기" 입력 (메인 검색어와 별개).
  const [spaceFilterQuery, setSpaceFilterQuery] = useState("");

  const recentSpaceEntries = useRecentSpacesStore((s) => s.entries);

  // 열릴 때마다 초기화.
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQ("");
      setSpaceId("");
      setAuthorId("");
      setDateFrom("");
      setDateTo("");
      setExpanded({ space: true });
      setSpaceFilterQuery("");
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
      { q: debouncedQ, spaceId, authorId, dateFrom, dateTo },
    ],
    queryFn: async () => {
      const qs = new URLSearchParams({ q: debouncedQ, limit: "30" });
      if (spaceId) qs.set("spaceId", spaceId);
      if (authorId) qs.set("authorId", authorId);
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

  // 우측 결과의 스페이스 매칭 — 메인 검색어를 스페이스 이름/설명에 ILIKE.
  // spaceId 필터가 걸려 있으면 스페이스 섹션은 생략.
  const matchedSpaces = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    if (!needle || spaceId) return [];
    return allSpaces.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        (s.description ?? "").toLowerCase().includes(needle),
    );
  }, [allSpaces, debouncedQ, spaceId]);

  const totalCount = pageTotal + matchedSpaces.length;

  // FILTER BY > Space 섹션 — "스페이스 찾기" 결과 또는 "최근 스페이스".
  const spaceFilterNeedle = spaceFilterQuery.trim().toLowerCase();
  const spaceFilterMatches = useMemo(() => {
    if (!spaceFilterNeedle) return [];
    return allSpaces.filter((s) =>
      s.name.toLowerCase().includes(spaceFilterNeedle),
    );
  }, [allSpaces, spaceFilterNeedle]);
  const recentSpaces = useMemo(() => {
    return recentSpaceEntries
      .map((e) => allSpaces.find((s) => s.id === e.spaceId))
      .filter((s): s is SpaceWithPages => !!s)
      .slice(0, 5);
  }, [recentSpaceEntries, allSpaces]);

  // "고급 검색" — 현재 필터를 /search 페이지로 전달.
  const advancedHref = useMemo(() => {
    const qs = new URLSearchParams();
    if (debouncedQ.trim()) qs.set("q", debouncedQ.trim());
    if (spaceId) qs.set("spaceId", spaceId);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    return `/search?${qs.toString()}`;
  }, [debouncedQ, spaceId, dateFrom, dateTo]);

  if (!open) return null;

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const openPage = (pageId: string) => {
    router.push(`/?pageId=${pageId}`);
    onClose();
  };

  const enterSpace = (sp: SpaceWithPages) => {
    const first = sp.pages[0];
    router.push(first ? `/?pageId=${first.id}` : `/?spaceId=${sp.id}`);
    onClose();
  };

  const selectedSpaceName = spaceId
    ? allSpaces.find((s) => s.id === spaceId)?.name ?? ""
    : "";

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
        {/* ── 좌측 FILTER BY ── */}
        <aside className="w-[240px] shrink-0 border-r border-[#dfe1e6] flex flex-col">
          <div className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
            Filter by
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Space */}
            <FilterSection
              label="Space"
              expanded={!!expanded.space}
              onToggle={() => toggle("space")}
            >
              <input
                type="text"
                value={spaceFilterQuery}
                onChange={(e) => setSpaceFilterQuery(e.target.value)}
                placeholder="스페이스 찾기..."
                className="w-full px-2 py-1 mb-2 text-[12px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
              />
              <button
                type="button"
                onClick={() => setSpaceId("")}
                className={`w-full text-left px-2 py-1 text-[13px] rounded ${
                  spaceId === ""
                    ? "bg-[#deebff] text-[#0052cc] font-semibold"
                    : "text-[#172b4d] hover:bg-[#f4f5f7]"
                }`}
              >
                전체 공간
              </button>
              {spaceFilterNeedle ? (
                spaceFilterMatches.length === 0 ? (
                  <div className="px-2 py-1 text-[12px] text-[#6b778c]">
                    일치하는 스페이스 없음
                  </div>
                ) : (
                  spaceFilterMatches.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSpaceId(s.id)}
                      className={`w-full text-left px-2 py-1 text-[13px] rounded truncate ${
                        spaceId === s.id
                          ? "bg-[#deebff] text-[#0052cc] font-semibold"
                          : "text-[#172b4d] hover:bg-[#f4f5f7]"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))
                )
              ) : (
                <>
                  <h2 className="px-2 pt-2 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
                    최근 스페이스
                  </h2>
                  {recentSpaces.length === 0 ? (
                    <div className="px-2 py-1 text-[12px] text-[#6b778c]">
                      최근 사용한 스페이스 없음
                    </div>
                  ) : (
                    recentSpaces.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSpaceId(s.id)}
                        className={`w-full text-left px-2 py-1 text-[13px] rounded truncate ${
                          spaceId === s.id
                            ? "bg-[#deebff] text-[#0052cc] font-semibold"
                            : "text-[#172b4d] hover:bg-[#f4f5f7]"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))
                  )}
                </>
              )}
            </FilterSection>

            {/* Contributor */}
            <FilterSection
              label="Contributor"
              expanded={!!expanded.contributor}
              onToggle={() => toggle("contributor")}
            >
              <label className="flex items-center gap-2 py-1 text-[13px] cursor-pointer">
                <input
                  type="radio"
                  name="contributor"
                  checked={authorId === ""}
                  onChange={() => setAuthorId("")}
                />
                <span>모든 작성자</span>
              </label>
              {(users ?? []).map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 py-1 text-[13px] cursor-pointer"
                >
                  <input
                    type="radio"
                    name="contributor"
                    checked={authorId === u.id}
                    onChange={() => setAuthorId(u.id)}
                  />
                  <span className="truncate">
                    {u.name}
                    <span className="text-[#6b778c]"> · {u.department}</span>
                  </span>
                </label>
              ))}
            </FilterSection>

            {/* Type — disabled */}
            <FilterSection
              label="Type"
              expanded={false}
              onToggle={() => {}}
              disabled
              disabledHint="현재 페이지 유형만 존재합니다. 추후 지원 예정."
            />

            {/* Date */}
            <FilterSection
              label="Date"
              expanded={!!expanded.date}
              onToggle={() => toggle("date")}
            >
              <div className="space-y-2 py-1">
                <label className="block text-[12px] text-[#6b778c]">
                  수정일 From
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="mt-0.5 w-full px-2 py-1 text-[12px] border border-[#dfe1e6] rounded"
                  />
                </label>
                <label className="block text-[12px] text-[#6b778c]">
                  수정일 To
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="mt-0.5 w-full px-2 py-1 text-[12px] border border-[#dfe1e6] rounded"
                  />
                </label>
              </div>
            </FilterSection>

            {/* Label — disabled */}
            <FilterSection
              label="Label"
              expanded={false}
              onToggle={() => {}}
              disabled
              disabledHint="라벨 기능은 추후 지원 예정입니다."
            />

            {/* Space category — disabled */}
            <FilterSection
              label="Space category"
              expanded={false}
              onToggle={() => {}}
              disabled
              disabledHint="공간 카테고리는 추후 지원 예정입니다."
            />
          </div>

          <div className="border-t border-[#dfe1e6] px-3 py-3">
            <button
              type="button"
              onClick={() => {
                router.push(advancedHref);
                onClose();
              }}
              className="text-[12px] text-[#0052cc] hover:underline"
            >
              고급 검색 →
            </button>
          </div>
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
                {isFetching
                  ? "검색 중..."
                  : `${totalCount}개의 검색 결과`}
                {selectedSpaceName && (
                  <span> · 공간: {selectedSpaceName}</span>
                )}
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
                          <div className="w-7 h-7 shrink-0 rounded bg-[#0052cc] text-white flex items-center justify-center text-[13px] font-bold">
                            {s.name.slice(0, 1).toUpperCase()}
                          </div>
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
