"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ACTIVITY_TYPES,
  formatActivity,
  type ActivityItem,
} from "@/lib/activity-format";
import UserSearchCombobox from "./UserSearchCombobox";

// Cycle 74-D — 공간 도구 '감사 로그' 탭. ActivityLog 를 스페이스 단위로 필터.
//   필터: 이벤트 타입 / 기간(from~to) / 사용자(actorId).
//   Cycle 84 followup 6 — '더 보기' append → 페이지네이션(이전/다음).
//   표시: 날짜 · 작성자 · 분류 · 요약 (4열).
const LIMIT = 20;

// type → 한국어 분류 라벨 (ACTIVITY_TYPES 의 '전체' 항목 제외).
const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ACTIVITY_TYPES.filter((t) => t.value).map((t) => [t.value, t.label]),
);

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function SpaceAuditPanel({ spaceId }: { spaceId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0); // 0-indexed

  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actor, setActor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      setLoading(true);
      try {
        const p = new URLSearchParams();
        p.set("limit", String(LIMIT));
        p.set("offset", String(offset));
        if (type) p.set("type", type);
        if (actor) p.set("actorId", actor.id);
        if (dateFrom) p.set("dateFrom", `${dateFrom}T00:00:00`);
        if (dateTo) p.set("dateTo", `${dateTo}T23:59:59.999`);
        const r = await fetch(
          `/api/spaces/${spaceId}/audit?${p.toString()}`,
          { credentials: "include" },
        );
        const data = r.ok
          ? ((await r.json()) as { items: ActivityItem[]; total: number })
          : { items: [], total: 0 };
        setItems(data.items);
        setTotal(data.total);
      } finally {
        setLoading(false);
      }
    },
    [spaceId, type, actor, dateFrom, dateTo],
  );

  // 필터 변경 시 첫 페이지로 리셋(다음 effect 가 새 페이지 로드).
  useEffect(() => {
    setPage(0);
  }, [type, dateFrom, dateTo, actor, spaceId]);

  // 페이지(또는 필터로 인한 page 리셋) 변경 시 로드.
  useEffect(() => {
    load(page * LIMIT);
  }, [load, page]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const safePage = Math.min(page, totalPages - 1);
  const startIdx = safePage * LIMIT;
  const endIdx = Math.min(startIdx + items.length, total);

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#42526e]">
            이벤트
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-2 py-1 text-[13px] border border-[#dfe1e6] rounded"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#42526e]">시작</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-1 text-[13px] border border-[#dfe1e6] rounded"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#42526e]">종료</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-1 text-[13px] border border-[#dfe1e6] rounded"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#42526e]">
            사용자
          </span>
          {actor ? (
            <span className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded text-[12px] bg-[#deebff] text-[#0052cc] border border-[#0052cc]">
              {actor.name}
              <button
                type="button"
                onClick={() => setActor(null)}
                className="px-1 leading-none hover:text-[#172b4d]"
                aria-label="사용자 필터 해제"
              >
                ×
              </button>
            </span>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="px-2 py-1 text-[13px] rounded border border-dashed border-[#c1c7d0] text-[#6b778c] hover:bg-[#f4f5f7]"
              >
                + 사용자
              </button>
              {pickerOpen && (
                <UserSearchCombobox
                  onSelect={(u) => {
                    setActor(u);
                    setPickerOpen(false);
                  }}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 목록 — 날짜 · 작성자 · 분류 · 요약 */}
      {items.length === 0 && !loading ? (
        <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
          조건에 맞는 활동이 없습니다.
        </div>
      ) : (
        <table className="w-full text-[13px] border border-[#dfe1e6] rounded-md overflow-hidden">
          <thead>
            <tr className="text-left text-[11px] text-[#6b778c] bg-[#f4f5f7] border-b border-[#dfe1e6]">
              <th className="px-3 py-2 font-semibold whitespace-nowrap">날짜</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">
                작성자
              </th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">분류</th>
              <th className="px-3 py-2 font-semibold">요약</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const fmt = formatActivity(it);
              return (
                <tr key={it.id} className="border-b border-[#f4f5f7]">
                  <td className="px-3 py-2 text-[#6b778c] whitespace-nowrap tabular-nums align-top">
                    {formatDateTime(it.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-[#172b4d] whitespace-nowrap align-top">
                    {fmt.actor}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-[#dfe1e6] text-[#42526e] text-[11px]">
                      {TYPE_LABEL[it.type] ?? it.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#172b4d] align-top">
                    {fmt.pageId ? (
                      <Link
                        href={`/?pageId=${fmt.pageId}`}
                        className="text-[#0052cc] hover:underline"
                      >
                        {fmt.text}
                      </Link>
                    ) : (
                      fmt.text
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-[12px] text-[#6b778c]">
          <span>
            총 {total}건 · {startIdx + 1}–{endIdx}건 ({safePage + 1}/
            {totalPages} 페이지)
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={loading || safePage === 0}
              className="px-3 py-1 rounded border border-[#dfe1e6] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f4f5f7]"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={loading || safePage >= totalPages - 1}
              className="px-3 py-1 rounded border border-[#dfe1e6] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f4f5f7]"
            >
              다음
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
