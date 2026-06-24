"use client";

import { useSearchParams } from "next/navigation";
import AppIcon, { type IconName } from "@/components/AppIcon";

type Tab = "general" | "launcher" | "smtp" | "users" | "groups";

type AdminNavItem = {
  tab: Tab;
  label: string;
  icon?: IconName;
  indent?: boolean;
};

const NAV_ITEMS: AdminNavItem[] = [
  { tab: "general", label: "일반 설정", icon: "settingsSliders" },
  { tab: "launcher", label: "응용 프로그램 탐색기", indent: true },
  { tab: "smtp", label: "SMTP 설정", indent: true },
  { tab: "users", label: "사용자 관리", icon: "user" },
  { tab: "groups", label: "그룹 관리", icon: "group" },
];

export default function AdminSidebar({
  collapsed = false,
  onExpand,
}: {
  collapsed?: boolean;
  onExpand: () => void;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const go = (tab: Tab) => {
    window.location.href = `/admin?tab=${tab}`;
  };

  if (collapsed) {
    return (
      <aside className="w-14 shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] h-full overflow-y-auto py-3 flex flex-col items-center gap-1 pb-5">
        {NAV_ITEMS.map((item) => {
          const active = tabParam === item.tab || (!tabParam && item.tab === "general");
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => go(item.tab)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`w-9 h-9 flex items-center justify-center rounded ${
                active
                  ? "bg-[#deebff] text-[#0052cc]"
                  : "text-[#42526e] hover:bg-[#ebecf0]"
              }`}
            >
              {!item.indent && <AppIcon name={item.icon!} size={16} alt={item.label} />}
            </button>
          );
        })}
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
        {NAV_ITEMS.map((item) => {
          const active = tabParam === item.tab || (!tabParam && item.tab === "general");
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => go(item.tab)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded text-[13px] text-left w-full ${
                item.indent ? "pl-9" : "px-3"
              } py-2 ${
                active
                  ? "bg-[#deebff] text-[#0052cc] font-semibold"
                  : item.indent
                    ? "text-[#42526e] hover:bg-[#ebecf0]"
                    : "text-[#172b4d] hover:bg-[#ebecf0]"
              }`}
            >
              {!item.indent && <AppIcon name={item.icon!} size={16} alt={item.label} />}
              <span className="flex-1">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}