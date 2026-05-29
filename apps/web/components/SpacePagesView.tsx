"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import PageCard from "@/components/PageCard";
import StatusFilterChips, {
  type StatusToken,
} from "@/components/StatusFilterChips";
import { relativeTime } from "@/lib/activity-format";
import type { PageStatus } from "@/lib/types";

// Cycle 51 — 스페이스 사이드바 '페이지' 메뉴 클릭 시 보이는 화면.
//   /?spaceId=X&view=pages 에서 마운트. 그 공간의 페이지를 updatedAt desc 로
//   카드 리스트로 표시. draft / 휴지통 제외는 백엔드 recent() 가 보장.
//   페이지네이션: '더 보기' 버튼(offset += LIMIT).
// Cycle 71 — 상태 필터(다중) 추가. ?status= 쿼리로 URL 동기화(새로고침/뒤로
//   가기 시 유지), 서버사이드 필터(recent ?status=) — 오프셋 페이징과 일관.

const LIMIT = 10;

type RecentPage = {
  id: string;
  title: string;
  spaceId: string;
  updatedAt: string;
  status?: PageStatus | null;
  space: { name: string };
  author?: { id: string; name: string } | null;
  lastEditor?: { id: string; name: string } | null;
};

type Props = {
  spaceId: string;
  spaceName?: string;
};

const VALID: ReadonlySet<string> = new Set([
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "NONE",
]);

export default function SpacePagesView({ spaceId, spaceName }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [pages, setPages] = useState<RecentPage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // URL ?status= 가 단일 출처. 선택된 토큰 배열 derive.
  const statusParam = searchParams.get("status") ?? "";
  const selected = useMemo(
    () =>
      statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => VALID.has(s)) as StatusToken[],
    [statusParam],
  );

  const load = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true);
      try {
        const statusQs = statusParam
          ? `&status=${encodeURIComponent(statusParam)}`
          : "";
        const r = await fetch(
          `/api/pages/recent?spaceId=${encodeURIComponent(spaceId)}&limit=${LIMIT}&offset=${offset}${statusQs}`,
          { credentials: "include" },
        );
        const data: RecentPage[] = r.ok ? await r.json() : [];
        setPages((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === LIMIT);
      } finally {
        setLoading(false);
      }
    },
    [spaceId, statusParam],
  );

  // spaceId / 필터 변경 시 초기화 + 첫 페이지 로드.
  useEffect(() => {
    setPages([]);
    setHasMore(true);
    load(0, false);
  }, [load]);

  const onLoadMore = () => {
    if (!loading) load(pages.length, true);
  };

  // 필터 변경 → URL 갱신(spaceId/view 유지). searchParams 변경이 load 를 재구동.
  const onFilterChange = (next: StatusToken[]) => {
    const params = new URLSearchParams();
    params.set("spaceId", spaceId);
    params.set("view", "pages");
    if (next.length) params.set("status", next.join(","));
    router.replace(`/?${params.toString()}`);
  };

  // 빈 상태 + 새 페이지 만들기. TopNav 의 + 만들기와 동일 패턴(draft 시작).
  const onCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const r = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: "제목 없음",
          content: "",
          spaceId,
          parentId: null,
          draft: true,
        }),
      });
      if (r.status === 401) {
        window.alert("로그인이 필요합니다.");
        return;
      }
      if (!r.ok) {
        window.alert("페이지 생성에 실패했습니다.");
        return;
      }
      const page = (await r.json()) as { id: string };
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      router.push(`/?pageId=${page.id}&edit=1`);
    } finally {
      setCreating(false);
    }
  };

  const filtering = selected.length > 0;

  return (
    <div className="max-w-[880px] px-6 pt-6 pb-16">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[22px] font-semibold text-[#172b4d]">
          {spaceName ? `${spaceName} · 페이지` : "페이지"}
        </h1>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="px-3 py-1.5 rounded bg-[#0052cc] hover:bg-[#0747a6] disabled:bg-[#a5adba] text-white text-[13px] font-medium"
        >
          ＋ 새 페이지
        </button>
      </div>

      {/* Cycle 71 — 상태 필터 칩. */}
      <div className="mb-4">
        <StatusFilterChips selected={selected} onChange={onFilterChange} />
      </div>

      {pages.length === 0 && !loading && (
        <div className="mt-4 text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-6 text-center">
          {filtering
            ? "선택한 상태의 페이지가 없습니다."
            : "이 공간에 아직 페이지가 없습니다. 위의 ‘＋ 새 페이지’ 버튼으로 첫 페이지를 만들어보세요."}
        </div>
      )}

      <div className="space-y-2">
        {pages.map((p) => {
          const editorName = p.lastEditor?.name ?? p.author?.name;
          const subtitle = editorName
            ? `${relativeTime(p.updatedAt)} · ${editorName}`
            : relativeTime(p.updatedAt);
          return (
            <PageCard
              key={p.id}
              id={p.id}
              title={p.title}
              subtitle={subtitle}
              icon="📄"
              status={p.status}
            />
          );
        })}
      </div>

      {loading && pages.length === 0 && (
        <div className="text-[12px] text-[#6b778c] mt-4">불러오는 중...</div>
      )}

      {hasMore && pages.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="px-4 py-2 text-[13px] border border-[#dfe1e6] rounded hover:bg-[#f4f5f7] disabled:opacity-50"
          >
            {loading ? "불러오는 중..." : "더 보기"}
          </button>
        </div>
      )}

      {!hasMore && pages.length > 0 && (
        <p className="text-[11px] text-[#6b778c] mt-6 text-center">
          모든 페이지를 불러왔습니다.
        </p>
      )}
    </div>
  );
}
