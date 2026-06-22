"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import AdminGeneralSettings from "./AdminGeneralSettings";
import AdminUsers from "./AdminUsers";
import AdminGroups from "./AdminGroups";

type Tab = "general" | "launcher" | "smtp" | "users" | "groups";
const TAB_LABEL: Record<Tab, string> = {
  general: "일반 설정",
  launcher: "응용 프로그램 탐색기",
  smtp: "SMTP 설정",
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
        : tabParam === "launcher"
          ? "launcher"
          : tabParam === "smtp"
            ? "smtp"
            : "general";

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "ADMIN") router.replace("/home");
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== "ADMIN") {
    return <div className="p-6 text-[13px] text-[#6b778c]">확인 중...</div>;
  }

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-white">
      <div className="flex min-w-0 flex-col gap-4 p-6">
        <h1 className="text-[20px] font-semibold text-[#172b4d] mb-4">
          {TAB_LABEL[tab]}
        </h1>
        {(tab === "general" || tab === "launcher" || tab === "smtp") && (
          <AdminGeneralSettings activeTab={tab as "general" | "launcher" | "smtp"} />
        )}
        {tab === "users" && <AdminUsers />}
        {tab === "groups" && <AdminGroups />}
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-[13px] text-[#6b778c]">로딩 중...</div>}
    >
      <AdminPageInner />
    </Suspense>
  );
}