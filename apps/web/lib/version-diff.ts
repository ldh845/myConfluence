import { diffLines } from "diff";

// FR-062 — 두 페이지 본문(Markdown 문자열)을 줄 단위로 비교한다.
// jsdiff는 변경된 청크를 Change[]로 돌려주는데, 각 청크의 value에는
// 여러 줄이 한 번에 담길 수 있으므로 "줄 + type" 페어로 평탄화해서
// 렌더 쪽이 그대로 map만 돌리면 되도록 한다.
export type DiffLine = {
  type: "add" | "remove" | "context";
  text: string;
};

export function computeLineDiff(
  oldText: string,
  newText: string,
): DiffLine[] {
  const parts = diffLines(oldText ?? "", newText ?? "");
  const out: DiffLine[] = [];
  for (const part of parts) {
    const type: DiffLine["type"] = part.added
      ? "add"
      : part.removed
        ? "remove"
        : "context";
    // value는 "라인1\n라인2\n" 형태가 많아 split 후 마지막 빈 토큰을
    // 떨어내야 가짜 빈 줄이 안 생긴다.
    const lines = part.value.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    for (const text of lines) out.push({ type, text });
  }
  return out;
}
