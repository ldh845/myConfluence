"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppIcon, { type IconName } from "@/components/AppIcon";

type Tab = "general" | "users" | "groups";

type AdminNavItem = {
  tab: Tab;
  label: string;
  icon: IconName;
};

const NAV_ITEMS: AdminNavItem[] = [
  { tab: "general", label: "일반 설정", icon: "settingsSliders" },
  { tab: "users", label: "사용자 관리", icon: "user" },
  { tab: "groups", label: "그룹 관리", icon: "group" },
];

function isActiveTab(tabParam: string | null, tab: Tab) {
  const allowed = NAV_ITEMS.map((item) => item.tab);
  if (!allowed.includes(tab)) return false;
  return tabParam === tab;
}

export default function AdminSidebar({
  collapsed = false,
  onExpand,
}: {
  collapsed?: boolean;
  onExpand: () => void;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  if (collapsed) {
    return (
      <aside className="w-14 shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] h-full overflow-y-auto py-3 flex flex-col items-center gap-1 pb-5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.tab}
            href={`/admin?tab=${item.tab}`}
            title={item.label}
            aria-label={item.label}
            aria-current={isActiveTab(tabParam, item.tab) ? "page" : undefined}
            className={`w-9 h-9 flex items-center justify-center rounded ${
              isActiveTab(tabParam, item.tab)
                ? "bg-[#deebff] text-[#0052cc]"
                : "text-[#42526e] hover:bg-[#ebecf0]"
            }`}
          >
            <AppIcon name={item.icon} size={16} alt={item.label} />
          </Link>
        ))}
      </aside>
    );
  }

  return (
    <aside className="w-[260px] shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <div className="text-[14px] font-bold text-[#172b4d]">
          관리자 설정
        </div>
      </div>

      <nav className="px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.tab}
            href={`/admin?tab=${item.tab}`}
            title={item.label}
            aria-label={item.label}
            aria-current={isActiveTab(tabParam, item.tab) ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] text-left ${
              isActiveTab(tabParam, item.tab)
                ? "bg-[#deebff] text-[#0052cc] font-semibold"
                : "text-[#172b4d] hover:bg-[#ebecf0]"
            }`}
          >
            <AppIcon name={item.icon} size={16} alt={item.label} />
            <span className="flex-1">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}