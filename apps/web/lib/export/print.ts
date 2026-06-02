// FR-121 (Cycle 21) — PDF 내보내기.
// 브라우저 인쇄 다이얼로그에 위임. 사용자가 "PDF로 저장" 옵션 선택.
// 인쇄 최적화는 globals.css의 @media print 블록이 담당.

export function openPrintDialog(): void {
  if (typeof window === "undefined") return;
  window.print();
}
