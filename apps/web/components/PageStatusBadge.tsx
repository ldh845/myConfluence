"use client";

import type { PageStatus } from "@/lib/types";

// Cycle 70 — 페이지 작업 상태 배지(표시 전용). status 가 없으면(null/undefined)
//   아무것도 렌더하지 않아 "의도적으로 상태를 안 정한" 페이지는 깔끔하게 둔다.
//   색상: To Do 회색 / In Progress 파랑 / Done 초록 (Confluence 톤).
export const STATUS_META: Record<
  PageStatus,
  { label: string; cls: string; dot: string }
> = {
  TODO: { label: "To Do", cls: "bg-[#dfe1e6] text-[#42526e]", dot: "#6b778c" },
  IN_PROGRESS: {
    label: "In Progress",
    cls: "bg-[#deebff] text-[#0052cc]",
    dot: "#0052cc",
  },
  DONE: { label: "Done", cls: "bg-[#e3fcef] text-[#006644]", dot: "#006644" },
  // Cycle 79 — Drop(중단/보류). 붉은 톤으로 구분.
  DROP: { label: "Drop", cls: "bg-[#ffebe6] text-[#bf2600]", dot: "#bf2600" },
};

export default function PageStatusBadge({
  status,
  className = "",
}: {
  status: PageStatus | null | undefined;
  className?: string;
}) {
  if (!status) return null;
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold leading-none ${m.cls} ${className}`}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: m.dot }}
      />
      {m.label}
    </span>
  );
}
