"use client";

import { useMemo } from "react";
import {
  computeLineDiff,
  countDiffStats,
  type DiffLine,
} from "@/lib/version-diff";

// FR-062 — 직전 버전과의 줄 단위 diff 시각화.
// 임의 두 버전 비교는 추후 사이클(체크박스 선택 UI 도입)에서 보강.

type Props = {
  oldTitle?: string | null;
  newTitle: string | null;
  oldText?: string;
  newText: string;
};

export default function PageVersionDiff({
  oldTitle,
  newTitle,
  oldText,
  newText,
}: Props) {
  const lines = useMemo(
    () => computeLineDiff(oldText ?? "", newText),
    [oldText, newText],
  );

  const stats = useMemo(
    () => countDiffStats(lines),
    [lines],
  );
  const diffLines = lines.filter((line) => line.type !== "context");

  const titleChanged = oldTitle && newTitle && oldTitle !== newTitle;
  const hasTextChange = stats.added > 0 || stats.removed > 0;
  const hasChange = hasTextChange || titleChanged;
  if (!hasChange) {
    return (
      <div className="mt-2 text-[11px] text-[#6b778c]">본문 변경 없음</div>
    );
  }

  return (
    <div className="mt-2">
      {titleChanged && (
        <div className="mb-2 rounded border border-[#ffe7ba] bg-[#fff7e6] px-2 py-1.5 text-[12px] leading-snug text-[#7a4b00]">
          <span className="font-medium">제목 변경</span>
          <div className="mt-1 grid grid-cols-[1fr_1.5fr] gap-2 text-[11px] leading-snug">
            <span className="line-clamp-2 text-rose-900 line-through">{oldTitle}</span>
            <span className="line-clamp-2 text-emerald-900">{newTitle}</span>
          </div>
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-1 font-mono text-[11px] leading-tight">
        {hasTextChange ? (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-900">삭제 {stats.removed}줄</span>
        ) : (
          <span className="rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[#42526e]">삭제 0줄</span>
        )}
        {hasTextChange ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-900">추가 {stats.added}줄</span>
        ) : (
          <span className="rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[#42526e]">추가 0줄</span>
        )}
      </div>

      {diffLines.length > 0 && (
        <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-md border border-[#dfe1e6] bg-white p-2 font-mono text-[11px] leading-snug">
          {diffLines.map((line, i) => (
            <DiffLine key={i} line={line} />
          ))}
        </pre>
      )}
    </div>
  );
}

function DiffLine({ line }: { line: DiffLine }) {
  const cls =
    line.type === "add"
      ? "bg-emerald-50 text-emerald-900"
      : line.type === "remove"
        ? "bg-rose-50 text-rose-900 line-through"
        : "text-[#6b778c]";
  const prefix = line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  ";

  return (
    <div className={`${cls} px-1`}>
      <span aria-hidden>{prefix}</span>
      {line.text}
    </div>
  );
}