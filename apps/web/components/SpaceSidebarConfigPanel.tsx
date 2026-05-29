"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PageNode,
  SpaceShortcut,
  SpaceShortcutType,
  SpaceWithPages,
} from "@/lib/types";

// Cycle 74-F — 공간 도구 '사이드바 구성' 탭. 스페이스 바로가기(내부 페이지/외부 URL)
//   추가·삭제·순서변경. 사이드바에 '바로가기' 섹션으로 노출됨(멤버 공통).
export default function SpaceSidebarConfigPanel({
  spaceId,
}: {
  spaceId: string;
}) {
  const qc = useQueryClient();
  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces", { credentials: "include" });
      return r.ok ? ((await r.json()) as SpaceWithPages[]) : [];
    },
  });
  const space = (spaces ?? []).find((s) => s.id === spaceId) ?? null;
  const shortcuts: SpaceShortcut[] = useMemo(
    () => [...(space?.shortcuts ?? [])].sort((a, b) => a.position - b.position),
    [space],
  );
  const pages: PageNode[] = useMemo(
    () => (space?.pages ?? []).filter((p) => p.publishedAt),
    [space],
  );

  const [type, setType] = useState<SpaceShortcutType>("INTERNAL_PAGE");
  const [label, setLabel] = useState("");
  const [pageId, setPageId] = useState("");
  const [url, setUrl] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["spaces"] });

  const add = useMutation({
    mutationFn: async () => {
      const isInternal = type === "INTERNAL_PAGE";
      const target = isInternal ? pageId : url.trim();
      const fallbackLabel = isInternal
        ? (pages.find((p) => p.id === pageId)?.title ?? "페이지")
        : url.trim();
      const body = {
        type,
        label: label.trim() || fallbackLabel,
        target,
      };
      const r = await fetch(`/api/spaces/${spaceId}/shortcuts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => {
      invalidate();
      setLabel("");
      setPageId("");
      setUrl("");
    },
    onError: () =>
      window.alert(
        "바로가기 추가에 실패했습니다. (URL 은 http/https 만, 페이지는 이 공간 소속이어야 합니다)",
      ),
  });

  const remove = useMutation({
    mutationFn: async (sid: string) => {
      const r = await fetch(`/api/spaces/${spaceId}/shortcuts/${sid}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      const r = await fetch(`/api/spaces/${spaceId}/shortcuts/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!r.ok) throw new Error();
    },
    onSuccess: invalidate,
  });

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...shortcuts];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    reorder.mutate(next.map((s) => s.id));
  };

  const canAdd =
    type === "INTERNAL_PAGE" ? !!pageId : url.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* 추가 폼 */}
      <div className="border border-[#dfe1e6] rounded-md p-3 space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as SpaceShortcutType)}
            className="px-2 py-1 text-[13px] border border-[#dfe1e6] rounded"
          >
            <option value="INTERNAL_PAGE">내부 페이지</option>
            <option value="EXTERNAL_URL">외부 URL</option>
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="표시 이름(선택)"
            className="flex-1 px-2 py-1 text-[13px] border border-[#dfe1e6] rounded"
          />
        </div>
        {type === "INTERNAL_PAGE" ? (
          <select
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            className="w-full px-2 py-1 text-[13px] border border-[#dfe1e6] rounded"
          >
            <option value="">페이지 선택…</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || "(제목 없음)"}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-2 py-1 text-[13px] border border-[#dfe1e6] rounded"
          />
        )}
        <button
          type="button"
          onClick={() => add.mutate()}
          disabled={!canAdd || add.isPending}
          className="px-3 py-1.5 rounded bg-[#0052cc] hover:bg-[#0747a6] disabled:bg-[#a5adba] text-white text-[13px] font-medium"
        >
          바로가기 추가
        </button>
      </div>

      {/* 목록 */}
      {shortcuts.length === 0 ? (
        <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
          바로가기가 없습니다. 위에서 추가하세요.
        </div>
      ) : (
        <ul className="space-y-1">
          {shortcuts.map((s, idx) => (
            <li
              key={s.id}
              className="flex items-center gap-2 px-2 py-1.5 border border-[#dfe1e6] rounded text-[13px]"
            >
              <span className="inline-block px-1.5 py-0.5 rounded bg-[#dfe1e6] text-[#42526e] text-[11px] shrink-0">
                {s.type === "INTERNAL_PAGE" ? "페이지" : "URL"}
              </span>
              <span className="flex-1 truncate text-[#172b4d]">{s.label}</span>
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="px-1 text-[#42526e] hover:bg-[#ebecf0] rounded disabled:text-[#c1c7d0]"
                title="위로"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === shortcuts.length - 1}
                className="px-1 text-[#42526e] hover:bg-[#ebecf0] rounded disabled:text-[#c1c7d0]"
                title="아래로"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`'${s.label}' 바로가기를 삭제할까요?`))
                    remove.mutate(s.id);
                }}
                className="px-1.5 text-[12px] text-[#bf2600] hover:underline"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
