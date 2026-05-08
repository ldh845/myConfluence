"use client";

import { useMemo } from "react";
import { computeLineDiff } from "@/lib/version-diff";

// FR-062 — 직전 버전과의 줄 단위 diff 시각화.
// 임의 두 버전 비교는 추후 사이클(체크박스 선택 UI 도입)에서 보강.

type Props = {
  oldContent: string;
  newContent: string;
};

export default function PageVersionDiff({ oldContent, newContent }: Props) {
  const lines = useMemo(
    () => computeLineDiff(oldContent, newContent),
    [oldContent, newContent],
  );

  const hasChange = lines.some((l) => l.type !== "context");
  if (!hasChange) {
    return (
      <div className="mt-2 text-[11px] text-[#6b778c]">변경 사항 없음</div>
    );
  }

  return (
    <pre className="mt-2 max-h-[280px] overflow-y-auto whitespace-pre-wrap rounded-md border border-[#dfe1e6] bg-white p-2 font-mono text-[11px] leading-snug">
      {lines.map((line, i) => {
        const cls =
          line.type === "add"
            ? "bg-emerald-50 text-emerald-900"
            : line.type === "remove"
              ? "bg-rose-50 text-rose-900 line-through"
              : "text-[#6b778c]";
        const prefix =
          line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  ";
        return (
          <div key={i} className={`${cls} px-1`}>
            <span aria-hidden>{prefix}</span>
            {line.text}
          </div>
        );
      })}
    </pre>
  );
}
