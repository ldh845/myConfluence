"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { relativeTime } from "@/lib/activity-format";
import type { PageStatus } from "@/lib/types";

// 스페이스 '페이지' 뷰 — 좌우 배치: 저장한 페이지(좌) + 최근 변경(우).
// /?spaceId=X&view=pages 에서 마운트.

const LIMIT = 20;

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

type SavedPage = {
  id: string;
  title: string;
  status?: PageStatus | null;
  spaceId: string;
  spaceName: string;
};

type Props = {
  spaceId: string;
  spaceName?: string;
};

type UserGroup = {
  userId: string;
  userName: string;
  pages: RecentPage[];
  latestAt: string;
};

export default function SpacePagesView({ spaceId, spaceName }: Props) {
  const [pages, setPages] = useState<RecentPage[]>([]);
  const [saved, setSaved] = useState<SavedPage[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async () => {
      setLoading(true);
      try {
        const [pagesRes, savedRes] = await Promise.all([
          fetch(
            `/api/pages/recent?spaceId=${encodeURIComponent(spaceId)}&limit=${LIMIT}`,
            { credentials: "include" },
          ),
          fetch(`/api/saves?spaceId=${encodeURIComponent(spaceId)}`, {
            credentials: "include",
          }),
        ]);
        const pagesData: RecentPage[] = pagesRes.ok ? await pagesRes.json() : [];
        const savedData: SavedPage[] = savedRes.ok ? await savedRes.json() : [];
        setPages(pagesData);
        setSaved(savedData);
      } finally {
        setLoading(false);
      }
    },
    [spaceId],
  );

  useEffect(() => {
    load();
  }, [load]);

  // lastEditor(없으면 author) 기준으로 사용자별 그룹화
  const groups = useMemo(() => {
    const map = new Map<string, UserGroup>();
    for (const p of pages) {
      const editor = p.lastEditor ?? p.author;
      const uid = editor?.id ?? "__unknown__";
      const uname = editor?.name ?? "알 수 없음";
      let group = map.get(uid);
      if (!group) {
        group = { userId: uid, userName: uname, pages: [], latestAt: p.updatedAt };
        map.set(uid, group);
      }
      group.pages.push(p);
      if (p.updatedAt > group.latestAt) group.latestAt = p.updatedAt;
    }
    return Array.from(map.values()).sort((a, b) =>
      b.latestAt.localeCompare(a.latestAt),
    );
  }, [pages]);

  return (
    <div className="px-6 pt-6 pb-16">
      <div className="mb-4">
        <h1 className="text-[22px] font-semibold text-[#172b4d]">
          {spaceName ? `${spaceName} · 페이지` : "페이지"}
        </h1>
      </div>

      {pages.length === 0 && saved.length === 0 && !loading && (
        <div className="mt-4 text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-6 text-center">
          이 공간에 아직 페이지가 없습니다.
        </div>
      )}

      {(pages.length > 0 || saved.length > 0) && (
        <div className="flex gap-8 items-start">
          {/* 좌: 나중을 위해 저장 */}
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-semibold text-[#42526e] mb-2">
              ☆ 나중을 위해 저장
            </h2>
            {saved.length === 0 ? (
              <div className="text-[12px] text-[#6b778c]">
                저장한 페이지가 없습니다. 페이지 상단의 ☆ 버튼을 눌러 추가하세요.
              </div>
            ) : (
              <div className="space-y-0.5">
                {saved.map((p) => (
                  <Link
                    key={p.id}
                    href={`/?pageId=${p.id}`}
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-[#f4f5f7] text-[13px] text-[#0052cc] hover:underline"
                  >
                    <span className="text-[#6b778c]">📄</span>
                    <span className="truncate">{p.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div className="w-px self-stretch bg-[#dfe1e6]" />

          {/* 우: 최근 변경 */}
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-semibold text-[#42526e] mb-2">
              최근 변경
            </h2>
            {groups.length === 0 ? (
              <div className="text-[12px] text-[#6b778c]">
                최근 변경된 페이지가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.userId}>
                    {/* 사용자 헤더 */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-full bg-[#0052cc] text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                        {group.userName.charAt(0)}
                      </div>
                      <span className="text-[13px] font-semibold text-[#172b4d]">
                        {group.userName}
                      </span>
                    </div>

                    {/* 해당 사용자가 수정한 페이지 목록 */}
                    <div className="ml-8 space-y-0.5">
                      {group.pages.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[#f4f5f7] group"
                        >
                          <span className="text-[12px] text-[#6b778c]">📄</span>
                          <Link
                            href={`/?pageId=${p.id}`}
                            className="text-[13px] text-[#0052cc] hover:underline truncate flex-1"
                          >
                            {p.title}
                          </Link>
                          <span className="text-[11px] text-[#6b778c] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            {relativeTime(p.updatedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && pages.length === 0 && saved.length === 0 && (
        <div className="text-[12px] text-[#6b778c] mt-4">불러오는 중...</div>
      )}
    </div>
  );
}