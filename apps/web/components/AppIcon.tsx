"use client";

import type { CSSProperties } from "react";

// Cycle 65 — public/icons 의 아이콘 자산을 의미 이름으로 매핑하는 공용 컴포넌트.
//   기존 이모지(✏️/💬/🔗 …)를 일관된 PNG/SVG 아이콘으로 대체한다.
//   next/image 는 SVG 를 기본 차단(images.dangerouslyAllowSVG=false)하므로,
//   PNG·SVG 를 한 컴포넌트에서 함께 다루기 위해 정적 <img> 를 직접 사용한다
//   (아이콘은 작은 로컬 자산이라 최적화 이득이 미미).
const ICON_SRC = {
  edit: "/icons/pencil_edit.png",
  pageEdit: "/icons/page_edit.svg",
  comment: "/icons/comment.png",
  watch: "/icons/watch.png",
  share: "/icons/share.png",
  link: "/icons/link.png",
  trash: "/icons/trash.png",
  plus: "/icons/plus.png",
  home: "/icons/home.svg",
  page: "/icons/page.svg",
  calendar: "/icons/calendar.svg",
  chart: "/icons/chart.svg",
  timeline: "/icons/timeline.svg",
  bulletList: "/icons/bullet_list.png",
  numberList: "/icons/number_list.png",
  star: "/icons/star.png",
  starOutline: "/icons/star_outline.png",
  user: "/icons/user.png",
  information: "/icons/information.png",
  dot: "/icons/dot.png",
  downArrow: "/icons/down-arrow.png",
  chevronDoubleDown: "/icons/chevron-double-down.png",
  // Cycle 79 — 에디터 툴바 아이콘.
  palette: "/icons/palette.svg",
  background: "/icons/background.png",
  image: "/icons/image.png",
  table: "/icons/table.png",
  // Cycle 81 — 페이지 제한 버튼(잠금/열림).
  lock: "/icons/lock.png",
  unlock: "/icons/unlock.png",
  // Cycle 84 followup 6 — 공간 도구 진입 아이콘.
  settings: "/icons/settings.png",
  // Cycle 84 followup 8 — 네비/사이드바 아이콘.
  search: "/icons/search.png",
  notification: "/icons/notification.png",
  chevron: "/icons/chevron.png",
  // Cycle 84 followup 9 — 접힌 스페이스 사이드바 섹션 아이콘.
  externalLink: "/icons/external-link.png",
  node: "/icons/node.png",
  // Cycle 87 — 표 컨텍스트 툴바 아이콘(좌/우 열 추가). 행 추가는 같은 자산을 90° 회전.
  columns: "/icons/columns.png",
  columns_left: "/icons/columns_left.png",
  // Cycle 88-2 — 새 아이콘 등록.
  cellDivide: "/icons/cell_divide.png",
  cellMerge: "/icons/cell_merge.png",
  space: "/icons/space.png",
  tag: "/icons/tag.png",
  crossedEye: "/icons/crossed-eye.svg",
} as const;

export type IconName = keyof typeof ICON_SRC;

export default function AppIcon({
  name,
  size = 16,
  className = "",
  alt = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  alt?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ICON_SRC[name]}
      alt={alt || name}
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", ...style }}
    />
  );
}
