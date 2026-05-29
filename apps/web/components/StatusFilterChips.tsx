"use client";

import type { PageStatus } from "@/lib/types";
import { STATUS_META } from "./PageStatusBadge";

// Cycle 71 — 페이지 목록 상태 필터 칩(다중 선택). 'NONE'=상태 없음.
//   선택 없음 = 전체. presentational — 선택 상태/URL 동기화는 부모(SpacePagesView).
export type StatusToken = PageStatus | "NONE";

const FILTERS: { value: StatusToken; label: string; dot?: string }[] = [
  { value: "NONE", label: "상태 없음" },
  { value: "TODO", label: STATUS_META.TODO.label, dot: STATUS_META.TODO.dot },
  {
    value: "IN_PROGRESS",
    label: STATUS_META.IN_PROGRESS.label,
    dot: STATUS_META.IN_PROGRESS.dot,
  },
  { value: "DONE", label: STATUS_META.DONE.label, dot: STATUS_META.DONE.dot },
];

function chipCls(active: boolean): string {
  return `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] border leading-none ${
    active
      ? "bg-[#deebff] border-[#0052cc] text-[#0052cc] font-semibold"
      : "bg-white border-[#dfe1e6] text-[#42526e] hover:bg-[#f4f5f7]"
  }`;
}

export default function StatusFilterChips({
  selected,
  onChange,
}: {
  selected: StatusToken[];
  onChange: (next: StatusToken[]) => void;
}) {
  const toggle = (v: StatusToken) =>
    onChange(
      selected.includes(v)
        ? selected.filter((x) => x !== v)
        : [...selected, v],
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange([])}
        className={chipCls(selected.length === 0)}
      >
        전체
      </button>
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => toggle(f.value)}
          className={chipCls(selected.includes(f.value))}
        >
          {f.dot && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: f.dot }}
            />
          )}
          {f.label}
        </button>
      ))}
    </div>
  );
}
