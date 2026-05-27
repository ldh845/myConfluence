"use client";

import { useQuery } from "@tanstack/react-query";
import {
  formatActivity,
  relativeTime,
  type ActivityItem,
} from "@/lib/activity-format";
import PageCard from "@/components/PageCard";

// Cycle 58 — 사용자 프로파일 페이지. /?profileId=<userId> 진입.
//   상단: 사용자 정보 카드 (name, department, role, createdAt)
//   하단: 이 사용자의 활동 피드 (GET /activities?actorId=)
//
// 라우트 컨벤션: SpacePagesView (Cycle 51) 와 같은 (app)/page.tsx 의 query
// 분기 패턴. 사이드바는 직전 컨텍스트(activeSpace) 그대로 — 사용자가 어느
// 공간에서 멘션을 클릭했는지 잃지 않음.

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  PART_LEADER: "파트장",
  DEVELOPER: "개발자",
  DESIGNER: "디자이너",
  PM: "PM",
};

type UserDetail = {
  id: string;
  username: string;
  name: string;
  department: string;
  role: string;
  createdAt: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Props = {
  userId: string;
};

export default function ProfileView({ userId }: Props) {
  const {
    data: user,
    isLoading: userLoading,
    isError: userError,
  } = useQuery<UserDetail | null>({
    queryKey: ["user", userId],
    queryFn: async () => {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        credentials: "include",
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("failed to load user");
      return (await r.json()) as UserDetail;
    },
  });

  const { data: activities } = useQuery<{
    items: ActivityItem[];
    total: number;
  }>({
    queryKey: ["activities", { actorId: userId, limit: 50 }],
    queryFn: async () => {
      const r = await fetch(
        `/api/activities?actorId=${encodeURIComponent(userId)}&limit=50`,
      );
      if (!r.ok) return { items: [], total: 0 };
      return (await r.json()) as { items: ActivityItem[]; total: number };
    },
    enabled: !!user,
  });

  if (userLoading) {
    return (
      <div className="px-8 lg:px-12 xl:px-16 pt-6 pb-16 text-[13px] text-[#6b778c]">
        프로파일을 불러오는 중...
      </div>
    );
  }

  if (userError || !user) {
    return (
      <div className="px-8 lg:px-12 xl:px-16 pt-6 pb-16">
        <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-6 text-center">
          사용자를 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  const items = activities?.items ?? [];

  return (
    <div className="px-8 lg:px-12 xl:px-16 pt-6 pb-16">
      {/* 상단 — 사용자 정보 카드 */}
      <div className="flex items-start gap-4 border border-[#dfe1e6] rounded-md p-5 bg-white">
        <div className="w-16 h-16 rounded-full bg-[#0052cc] text-white flex items-center justify-center text-2xl font-semibold shrink-0">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[22px] font-semibold text-[#172b4d]">
            {user.name}
          </div>
          <div className="mt-1 text-[13px] text-[#6b778c] flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{user.department || "(부서 없음)"}</span>
            <span>·</span>
            <span>{ROLE_LABELS[user.role] ?? user.role}</span>
            <span>·</span>
            <span>@{user.username}</span>
          </div>
          <div className="mt-2 text-[12px] text-[#a5adba]">
            가입일 {formatDate(user.createdAt)}
          </div>
        </div>
      </div>

      {/* 하단 — 활동 피드 */}
      <h2 className="mt-8 text-[16px] font-semibold text-[#172b4d] mb-3">
        활동
      </h2>
      {items.length === 0 ? (
        <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-6 text-center">
          기록된 활동이 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const f = formatActivity(item);
            return (
              <li key={item.id}>
                {item.page ? (
                  <PageCard
                    id={item.page.id}
                    title={item.page.title}
                    spaceName={item.space?.name}
                    subtitle={`${f.text} · ${relativeTime(item.createdAt)}`}
                    icon={f.icon}
                  />
                ) : (
                  <div className="border border-[#dfe1e6] rounded-md p-3 text-[13px]">
                    <div className="flex items-start gap-2">
                      <span className="text-[16px] leading-none mt-0.5">
                        {f.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[#172b4d]">{f.text}</div>
                        <div className="text-[11px] text-[#6b778c] mt-0.5">
                          {item.space?.name}
                          {item.space?.name && " · "}
                          {relativeTime(item.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="text-[11px] text-[#a5adba] mt-6 text-center">
        최근 50개 활동
      </div>
    </div>
  );
}
