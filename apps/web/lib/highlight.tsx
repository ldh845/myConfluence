import type { ReactNode } from "react";

// FR-090 (Cycle 15-2) — 검색어 하이라이트.
// case-insensitive 부분 매칭, 다중 occurrence 모두 <mark>로 감싼다.
// indexOf 기반이라 검색어에 정규식 메타문자가 있어도 안전.
export function highlightText(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q || !text) return text;
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  let idx = lowerText.indexOf(lowerQ);
  while (idx !== -1) {
    if (idx > lastIdx) parts.push(text.substring(lastIdx, idx));
    parts.push(
      <mark
        key={key++}
        className="bg-yellow-200 text-[#172b4d] px-0.5 rounded"
      >
        {text.substring(idx, idx + q.length)}
      </mark>,
    );
    lastIdx = idx + q.length;
    idx = lowerText.indexOf(lowerQ, lastIdx);
  }
  if (lastIdx < text.length) parts.push(text.substring(lastIdx));
  return <>{parts}</>;
}
