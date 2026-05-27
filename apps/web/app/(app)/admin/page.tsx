"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import AdminGeneralSettings from "./AdminGeneralSettings";
import AdminUsers from "./AdminUsers";

// Cycle 48 — 관리자 페이지 (/admin). (app) route group 안이라 TopNav+Sidebar
// 셸이 자동 적용. ADMIN 만 접근 — 비-ADMIN 진입 시 /home 으로 redirect.
// 백엔드 RolesGuard 가 이중 가드(데이터 API 가 403 반환).
//
// Cycle 48 followup — 좌측 탭 사이드바 제거. 탭 전환은 TopNav 톱니바퀴 드롭다운
// (?tab=general | ?tab=users) 으로만. 페이지는 useSearchParams 로 초기 탭만 결정.

type Tab = "general" | "users";
const TAB_LABEL: Record<Tab, string> = {
  general: "일반 설정",
  users: "사용자 관리",
};

function AdminPageInner() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = tabParam === "users" ? "users" : "general";

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "ADMIN") router.replace("/home");
  }, [user, isLoading, router]);

  // 인증 로딩/리다이렉트 직전 짧은 빈 화면 — 비-ADMIN 한테 콘텐츠가 잠깐도 안 보임.
  if (isLoading || !user || user.role !== "ADMIN") {
    return <div className="p-6 text-[13px] text-[#6b778c]">확인 중...</div>;
  }

  return (
    <main className="h-full min-h-0 overflow-auto bg-[#f4f5f7]">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-[20px] font-semibold text-[#172b4d] mb-4">
          {TAB_LABEL[tab]}
        </h1>
        {tab === "general" && <AdminGeneralSettings />}
        {tab === "users" && <AdminUsers />}
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
