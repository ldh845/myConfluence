"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/useAuth";

// Cycle 59 — TopNav 종 아이콘 + dropdown 알림 패널.
//   AdminGearButton 패턴 답습 (useRef + mousedown 외부 클릭 + Esc).
//   비-로그인 시 DOM 미생성.

type ActorBrief = {
  id: string;
  name: string;
  department: string;
} | null;

type PageBrief = {
  id: string;
  title: string;
  deletedAt: string | null;
} | null;

type NotificationItem = {
  id: string;
  recipientId: string;
  actorId: string | null;
  type: string;
  pageId: string | null;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  actor: ActorBrief;
  page: PageBrief;
};

type ListResponse = { items: NotificationItem[]; unreadCount: number };

function relativeTime(iso: string): string {
  const diff = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}초 전`;
  const m = Math.round(diff / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return `${d}일 전`;
}

// Cycle 60 — type 별 문구/아이콘 분기.
//   mention: 멘션 / comment.created: 내 페이지에 댓글 / comment.reply: 내 댓글에 답글
function describeNotification(item: NotificationItem): {
  icon: string;
  text: string;
} {
  const actorName =
    item.actor?.name ??
    (typeof item.payload?.actorName === "string"
      ? item.payload.actorName
      : "누군가");
  const pageTitle =
    item.page?.title ??
    (typeof item.payload?.pageTitle === "string"
      ? item.payload.pageTitle
      : "(페이지)");
  switch (item.type) {
    case "comment.created":
      return {
        icon: "💬",
        text: `${actorName}님이 '${pageTitle}'에 댓글을 달았습니다`,
      };
    case "comment.reply":
      return {
        icon: "↩️",
        text: `${actorName}님이 회원님 댓글에 답글을 달았습니다 ('${pageTitle}')`,
      };
    case "mention":
    default:
      return {
        icon: "🔔",
        text: `${actorName}님이 '${pageTitle}'에서 회원님을 언급했습니다`,
      };
  }
}

export default function NotificationBellButton() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery<ListResponse>({
    queryKey: ["notifications", user?.id ?? null],
    queryFn: async () => {
      const r = await fetch("/api/notifications?limit=30", {
        credentials: "include",
      });
      if (!r.ok) return { items: [], unreadCount: 0 };
      return (await r.json()) as ListResponse;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000, // 1분마다 polling — 새 알림 감지
  });

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["notifications", user?.id ?? null],
    });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
      });
    },
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/read-all", {
        method: "PATCH",
        credentials: "include",
      });
    },
    onSuccess: invalidate,
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const handleItemClick = (item: NotificationItem) => {
    setOpen(false);
    if (!item.readAt) markRead.mutate(item.id);
    // 페이지 있으면 페이지로, 없으면 actor 프로파일로.
    if (item.page && !item.page.deletedAt) {
      router.push(`/?pageId=${item.page.id}`);
    } else if (item.actor) {
      router.push(`/?profileId=${item.actor.id}`);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-8 h-8 rounded text-[#42526e] hover:bg-[#ebecf0]"
        aria-label="알림"
        title="알림"
      >
        <span className="text-[18px]">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#de350b] text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white border border-[#dfe1e6] rounded-md shadow-lg z-30">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#dfe1e6]">
            <span className="text-[13px] font-semibold text-[#172b4d]">
              알림 {unreadCount > 0 && <span className="text-[#de350b]">({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-[11px] text-[#0052cc] hover:underline disabled:opacity-50"
              >
                모두 읽음
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto py-1">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-[12px] text-[#6b778c] text-center">
                알림이 없습니다.
              </div>
            ) : (
              items.map((item) => {
                const unread = !item.readAt;
                const { icon, text } = describeNotification(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left px-3 py-2 text-[13px] flex items-start gap-2 hover:bg-[#ebecf0] ${
                      unread ? "bg-[#f4f8ff]" : ""
                    }`}
                  >
                    {unread ? (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-[#0052cc] shrink-0" />
                    ) : (
                      <span className="mt-1.5 w-2 h-2 shrink-0" />
                    )}
                    <span className="text-[14px] leading-none mt-0.5">
                      {icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[#172b4d]">{text}</div>
                      <div className="text-[11px] text-[#6b778c] mt-0.5">
                        {relativeTime(item.createdAt)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
