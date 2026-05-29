"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ACTIVITY_TYPES,
  formatActivity,
  relativeTime,
  type ActivityItem,
} from "@/lib/activity-format";
import UserSearchCombobox from "./UserSearchCombobox";

// Cycle 74-D — 공간 도구 '감사 로그' 탭. ActivityLog 를 스페이스 단위로 필터.
//   필터: 이벤트 타입 / 기간(from~to) / 사용자(actorId). 페이지네이션 '더 보기'.
const LIMIT = 20;

export default function SpaceAuditPanel({ spaceId }: { spaceId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actor, setActor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(
    async (offset: number, append: boolean) => {
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
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
      } finally {
        setLoading(false);
      }
    },
    [spaceId, type, actor, dateFrom, dateTo],
  );

  // 필터 변경 시 처음부터 다시 로드.
  useEffect(() => {
    load(0, false);
  }, [load]);

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

      {/* 목록 */}
      {items.length === 0 && !loading ? (
        <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
          조건에 맞는 활동이 없습니다.
        </div>
      ) : (
        <ul className="border border-[#dfe1e6] rounded-md divide-y divide-[#dfe1e6] bg-white">
          {items.map((it) => {
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
                    {fmt.actor} · {relativeTime(it.createdAt)}
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

      {items.length < total && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => load(items.length, true)}
            disabled={loading}
            className="px-4 py-2 text-[13px] border border-[#dfe1e6] rounded hover:bg-[#f4f5f7] disabled:opacity-50"
          >
            {loading ? "불러오는 중..." : "더 보기"}
          </button>
        </div>
      )}
      {total > 0 && (
        <p className="text-[11px] text-[#6b778c] text-center">
          총 {total}건 중 {items.length}건 표시
        </p>
      )}
    </div>
  );
}
