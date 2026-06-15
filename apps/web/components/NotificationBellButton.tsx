"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/useAuth";
import AppIcon from "@/components/AppIcon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Cycle 59 — TopNav 종 아이콘 + dropdown 알림 패널.
//   AdminGearButton 패턴 답습 (useRef + mousedown 외부 클릭 + Esc).
//   비-로그인 시 DOM 미생성.
//    Polling: 1분 → 10초로 단축 (실시간성 개선).
//    알림 설정 (로컬 localStorage 기반, 향후 Backend 연동)

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
//   iconKey: AppIcon 에서 사용하는 아이콘명
function describeNotification(item: NotificationItem): {
  iconKey: "comment" | "information" | "notification";
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
        iconKey: "comment",
        text: `${actorName}님이 '${pageTitle}'에 댓글을 달았습니다`,
      };
    case "comment.reply":
      return {
        iconKey: "comment",
        text: `${actorName}님이 회원님 댓글에 답글을 달았습니다 ('${pageTitle}')`,
      };
    case "page.updated":
      return {
        iconKey: "information",
        text: `${actorName}님이 회원님이 지켜보는 '${pageTitle}'을(를) 업데이트했습니다`,
      };
    case "mention":
    default:
      return {
        iconKey: "notification",
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
  // 알림 설정 다이얼로그
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 로컬 알림 설정 저장/불러오기 (localStorage 기반)
  const [prefs, setPrefs] = useState({
    mention: true,
    comment: true,
    pageUpdated: true,
  });

  // 초기 마운트 시에만 localStorage 에 저장된 설정을 불러옵니다.
  // (user 객체는 컴포넌트가 렌더링 될 때 이미 로그인 상태이므로 [] 의존성으로 한번만 실행 가능)
  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(`docspace-notify-prefs-${user.id}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setPrefs(parsed);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const savePrefs = (p: typeof prefs) => {
    setPrefs(p);
    if (!user) return;
    localStorage.setItem(
      `docspace-notify-prefs-${user.id}`,
      JSON.stringify(p)
    );
  };

  // 수신하려는 type 목록 (설정 기반) - 메모이제이션
  const allowedTypes = useMemo(() => {
    const types = new Set<string>();
    if (prefs.mention) types.add("mention");
    if (prefs.comment) {
      types.add("comment.created");
      types.add("comment.reply");
    }
    if (prefs.pageUpdated) types.add("page.updated");
    return types;
  }, [prefs]);

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
    staleTime: 5_000,
    refetchInterval: 10_000, // 10초마다 polling — 실시간성 개선
  });

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // 수신 설정에 맞지 않으면 필터링 (알림 센터/드롭다운共通) - 메모이제이션
  const visibleItems = useMemo(
    () => items.filter((item) => allowedTypes.has(item.type)),
    [items, allowedTypes]
  );

  // 필터링된 목록으로 알림 표시 개수 계산 - 메모이제이션
  const visibleUnreadCount = useMemo(
    () => visibleItems.filter((i) => !i.readAt).length,
    [visibleItems]
  );

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
        <AppIcon name="notification" size={18} alt="알림" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#de350b] text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white border border-[#dfe1e6] rounded-md shadow-lg z-30">
          {/* 헤더: 알림 개수 + 모두 읽음 + 알림센터 링크 + 설정 */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#dfe1e6]">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#172b4d]">
                알림 {visibleUnreadCount > 0 && <span className="text-[#de350b]">({visibleUnreadCount})</span>}
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
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSettingsOpen(true);
              }}
              className="text-[11px] text-[#0052cc] hover:underline"
              title="알림 설정"
            >
              설정
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto py-1">
            {visibleItems.length === 0 ? (
              <div className="px-3 py-6 text-[12px] text-[#6b778c] text-center">
                알림이 없습니다.
              </div>
            ) : (
              visibleItems.map((item) => {
                const unread = !item.readAt;
                const { iconKey, text } = describeNotification(item);
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
                    <span className="text-[#6b778c] leading-none mt-0.5 shrink-0">
                      <AppIcon name={iconKey} size={14} alt="" />
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

      {/* 알림 설정 다이얼로그 */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>알림 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-[12px] text-[#6b778c]">
              받을 알림 유형을 선택하세요. 설정은 브라우저에 저장되며, 향후 서버 연동을 통해 기기 간 동기화를 지원합니다.
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="inline-flex items-center gap-2 text-[13px] text-[#172b4d]">
                <AppIcon name="notification" size={14} alt="@" />
                <span>@ 멘션</span>
              </span>
              <input
                type="checkbox"
                checked={prefs.mention}
                onChange={(e) => savePrefs({ ...prefs, mention: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="inline-flex items-center gap-2 text-[13px] text-[#172b4d]">
                <AppIcon name="comment" size={14} alt="댓글" />
                <span>댓글 및 답글</span>
              </span>
              <input
                type="checkbox"
                checked={prefs.comment}
                onChange={(e) =>
                  savePrefs({ ...prefs, comment: e.target.checked })
                }
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="inline-flex items-center gap-2 text-[13px] text-[#172b4d]">
                <AppIcon name="information" size={14} alt="업데이트" />
                <span>지켜보던 페이지 업데이트</span>
              </span>
              <input
                type="checkbox"
                checked={prefs.pageUpdated}
                onChange={(e) =>
                  savePrefs({ ...prefs, pageUpdated: e.target.checked })
                }
              />
             </label>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="px-3 py-1.5 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6]"
              >
                닫기
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
