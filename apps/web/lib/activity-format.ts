// FR-131 (Cycle 24) — 활동 type별 한국어 문구 + 시간 포맷.
// 홈 카드와 /activity 페이지에서 공통 사용.

export type ActivityActor = {
  id: string;
  username: string;
  name: string;
  department: string;
  role: string;
};

export type ActivityItem = {
  id: string;
  type: string;
  spaceId: string | null;
  pageId: string | null;
  actorId: string | null;
  actorName: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
  space: { id: string; name: string } | null;
  page: { id: string; title: string; deletedAt: string | null } | null;
  // FR-001 (Cycle 27e) — actor join. user 삭제 후엔 null이며 actorName으로 fallback.
  actor: ActivityActor | null;
};

export const ACTIVITY_TYPES: Array<{ value: string; label: string }> = [
  { value: "", label: "전체" },
  { value: "page.created", label: "페이지 생성" },
  { value: "page.published", label: "페이지 발행" },
  { value: "page.updated", label: "페이지 수정" },
  { value: "page.moved", label: "페이지 이동" },
  { value: "page.copied", label: "페이지 복사" },
  { value: "page.soft_deleted", label: "휴지통 이동" },
  { value: "page.restored", label: "휴지통 복구" },
  { value: "page.permanent_deleted", label: "영구 삭제" },
  { value: "page.status_changed", label: "상태 변경" },
  { value: "comment.created", label: "댓글" },
];

// Cycle 70 — 활동 피드 텍스트용 상태 라벨.
const STATUS_LABEL: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  DROP: "Drop",
};

export type FormattedActivity = {
  icon: string;
  text: string;
  pageId: string | null;
  pageTitle: string;
  spaceName: string | null;
  actor: string;
};

export function formatActivity(item: ActivityItem): FormattedActivity {
  // FR-001 (Cycle 27e) — actor join 우선, 없으면 snapshot actorName fallback.
  const actor = item.actor?.name ?? item.actorName ?? "누군가";
  const spaceName = item.space?.name ?? null;
  const payload = item.payload ?? {};
  const payloadTitle =
    typeof payload.title === "string" ? payload.title : null;
  const deletedTitle =
    typeof payload.deletedTitle === "string" ? payload.deletedTitle : null;
  const deletedSpaceName =
    typeof payload.deletedSpaceName === "string"
      ? payload.deletedSpaceName
      : null;
  const preview =
    typeof payload.preview === "string" ? payload.preview : "";
  const pageTitle = item.page?.title ?? payloadTitle ?? "(제목 없음)";

  switch (item.type) {
    case "page.created":
      return {
        icon: "🆕",
        text: `${actor}이(가) '${pageTitle}' 페이지를 생성했습니다`,
        pageId: item.pageId,
        pageTitle,
        spaceName,
        actor,
      };
    case "page.status_changed": {
      const to = typeof payload.to === "string" ? payload.to : null;
      const toLabel = to ? (STATUS_LABEL[to] ?? to) : null;
      return {
        icon: "🏷️",
        text: toLabel
          ? `${actor}이(가) '${pageTitle}' 상태를 '${toLabel}'(으)로 변경했습니다`
          : `${actor}이(가) '${pageTitle}' 상태를 제거했습니다`,
        pageId: item.pageId,
        pageTitle,
        spaceName,
        actor,
      };
    }
    case "page.published":
      return {
        icon: "🚀",
        text: `'${pageTitle}' 페이지가 발행되었습니다`,
        pageId: item.pageId,
        pageTitle,
        spaceName,
        actor,
      };
    case "page.updated":
      return {
        icon: "✏️",
        text: `${actor}님이 '${pageTitle}' 페이지를 수정했습니다`,
        pageId: item.pageId,
        pageTitle,
        spaceName,
        actor,
      };
    case "page.moved":
      return {
        icon: "↗",
        text: `'${pageTitle}' 페이지가 이동되었습니다`,
        pageId: item.pageId,
        pageTitle,
        spaceName,
        actor,
      };
    case "page.copied":
      return {
        icon: "⧉",
        text: `'${pageTitle}' 페이지가 복사되었습니다`,
        pageId: item.pageId,
        pageTitle,
        spaceName,
        actor,
      };
    case "page.soft_deleted":
      return {
        icon: "🗑️",
        text: `'${pageTitle}' 페이지가 휴지통으로 이동되었습니다`,
        pageId: item.pageId,
        pageTitle,
        spaceName,
        actor,
      };
    case "page.restored":
      return {
        icon: "♻️",
        text: `'${pageTitle}' 페이지가 복구되었습니다`,
        pageId: item.pageId,
        pageTitle,
        spaceName,
        actor,
      };
    case "page.permanent_deleted":
      return {
        icon: "❌",
        text: `'${deletedTitle ?? "(제목 없음)"}' 페이지가 영구 삭제되었습니다`,
        pageId: null,
        pageTitle: deletedTitle ?? "(제목 없음)",
        spaceName: deletedSpaceName,
        actor,
      };
    case "comment.created":
      return {
        icon: "💬",
        text: `${actor}이(가) '${pageTitle}' 페이지에 댓글: ${preview}`,
        pageId: item.pageId,
        pageTitle,
        spaceName,
        actor,
      };
    default:
      return {
        icon: "•",
        text: `${item.type}`,
        pageId: item.pageId,
        pageTitle,
        spaceName,
        actor,
      };
  }
}

export function relativeTime(iso: string): string {
  const diff = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (diff < 60) return `${diff}초 전`;
  const m = Math.round(diff / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return `${d}일 전`;
}
