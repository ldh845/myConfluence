"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import PageCard from "@/components/PageCard";
import { relativeTime } from "@/lib/activity-format";

// Cycle 51 — 스페이스 사이드바 '페이지' 메뉴 클릭 시 보이는 화면.
//   /?spaceId=X&view=pages 에서 마운트. 그 공간의 페이지를 updatedAt desc 로
//   카드 리스트로 표시. 과거의 "첫 페이지로 자동 이동" 동작을 폐기.
//   draft(publishedAt=null) / 휴지통(deletedAt!=null) 제외는 백엔드 recent() 가 보장.
//   페이지네이션: '더 보기' 버튼(offset += LIMIT) — 코드베이스 다른 리스트가
//   서버 페이징 없이 단발이라 가장 단순한 패턴 채택.

const LIMIT = 10;

type RecentPage = {
  id: string;
  title: string;
  spaceId: string;
  updatedAt: string;
  space: { name: string };
  author?: { id: string; name: string } | null;
  lastEditor?: { id: string; name: string } | null;
};

type Props = {
  spaceId: string;
  spaceName?: string;
};

export default function SpacePagesView({ spaceId, spaceName }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pages, setPages] = useState<RecentPage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/pages/recent?spaceId=${encodeURIComponent(spaceId)}&limit=${LIMIT}&offset=${offset}`,
          { credentials: "include" },
        );
        const data: RecentPage[] = r.ok ? await r.json() : [];
        setPages((prev) => (append ? [...prev, ...data] : data));
        // 한 페이지가 LIMIT 만큼 채워지지 않았으면 더 없음.
        setHasMore(data.length === LIMIT);
      } finally {
        setLoading(false);
      }
    },
    [spaceId],
  );

  // spaceId 변경(다른 공간으로 진입) 시 초기화 + 첫 페이지 로드.
  useEffect(() => {
    setPages([]);
    setHasMore(true);
    load(0, false);
  }, [load]);

  const onLoadMore = () => {
    if (!loading) load(pages.length, true);
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
          // Cycle 35 — draft 로 시작. 발행 전엔 트리/목록 양쪽에서 숨김.
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
      // spaces 캐시 갱신(현재는 draft 라 트리에 안 보이지만 ?pageId 진입 시
      // activeSpace 결정을 위해).
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      router.push(`/?pageId=${page.id}&edit=1`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-[880px] px-6 pt-6 pb-16">
      <div className="flex items-center justify-between mb-5">
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

      {pages.length === 0 && !loading && (
        <div className="mt-4 text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-6 text-center">
          이 공간에 아직 페이지가 없습니다. 위의 &lsquo;＋ 새 페이지&rsquo;
          버튼으로 첫 페이지를 만들어보세요.
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
