"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import AdminGeneralSettings from "./AdminGeneralSettings";
import AdminUsers from "./AdminUsers";

// Cycle 48 — 관리자 페이지 (/admin). (app) route group 안이라 TopNav+Sidebar
// 셸이 자동 적용. ADMIN 만 접근 — 비-ADMIN 진입 시 /home 으로 redirect.
// 백엔드 RolesGuard 가 이중 가드(데이터 API 가 403 반환).

type Tab = "general" | "users";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "일반 설정" },
  { id: "users", label: "사용자 관리" },
];

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("general");

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "ADMIN") router.replace("/home");
  }, [user, isLoading, router]);

  // 인증 로딩/리다이렉트 직전 짧은 빈 화면 — 비-ADMIN 한테 콘텐츠가 잠깐도 안 보임.
  if (isLoading || !user || user.role !== "ADMIN") {
    return <div className="p-6 text-[13px] text-[#6b778c]">확인 중...</div>;
  }

  return (
    <div className="flex h-full min-h-0 bg-[#f4f5f7]">
      <aside className="w-56 shrink-0 bg-white border-r border-[#dfe1e6] py-4">
        <div className="px-4 pb-3 text-[11px] font-semibold text-[#6b778c] uppercase tracking-wide">
          관리자
        </div>
        <nav className="flex flex-col">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`text-left px-4 py-2 text-[13px] ${
                tab === t.id
                  ? "bg-[#e9f2ff] text-[#0052cc] font-semibold border-l-2 border-[#0052cc]"
                  : "text-[#172b4d] hover:bg-[#f4f5f7] border-l-2 border-transparent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-3xl mx-auto p-6">
          <h1 className="text-[20px] font-semibold text-[#172b4d] mb-4">
            {TABS.find((t) => t.id === tab)?.label}
          </h1>
          {tab === "general" && <AdminGeneralSettings />}
          {tab === "users" && <AdminUsers />}
        </div>
      </main>
    </div>
  );
}
