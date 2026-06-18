"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import AdminGeneralSettings from "./AdminGeneralSettings";
import AdminUsers from "./AdminUsers";
import AdminGroups from "./AdminGroups";

// Cycle 48 — 관리자 페이지 (/admin). (app) route group 안이라 TopNav+Sidebar
// 셸이 자동 적용. ADMIN 만 접근 — 비-ADMIN 진입 시 /home 으로 redirect.
// 백엔드 RolesGuard 가 이중 가드(데이터 API 가 403 반환).
//
// Cycle 48 followup — TopNav 톱니바퀴 드롭다운은 /admin?tab=general|users|groups
// 로 이동하고, 실제 화면 구성은 AdminSidebar + 선택 항목으로 분리한다.

type Tab = "general" | "users" | "groups";
const TAB_LABEL: Record<Tab, string> = {
  general: "일반 설정",
  users: "사용자 관리",
  groups: "그룹 관리",
};

function AdminPageInner() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    tabParam === "users"
      ? "users"
      : tabParam === "groups"
        ? "groups"
        : "general";

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "ADMIN") router.replace("/home");
  }, [user, isLoading, router]);

  // 인증 로딩/리다이렉트 직전 짧은 빈 화면 — 비-ADMIN 한테 콘텐츠가 잠깐도 안 보임.
  if (isLoading || !user || user.role !== "ADMIN") {
    return <div className="p-6 text-[13px] text-[#6b778c]">확인 중...</div>;
  }

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-white">
      <div className="flex min-w-0 flex-col gap-4 p-6">
        <h1 className="text-[20px] font-semibold text-[#172b4d] mb-4">
          {TAB_LABEL[tab]}
        </h1>
        {tab === "general" && <AdminGeneralSettings />}
        {tab === "users" && <AdminUsers />}
        {tab === "groups" && <AdminGroups />}
      </div>
    </main>
  );
}

// useSearchParams 는 Suspense 경계 안에서 호출되어야 한다(Next 14 권장 패턴).
// login/page.tsx · (app)/layout.tsx 와 동일 패턴.
export default function AdminPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-[13px] text-[#6b778c]">로딩 중...</div>}
    >
      <AdminPageInner />
    </Suspense>
  );
}
