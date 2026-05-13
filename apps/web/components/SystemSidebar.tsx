"use client";

import { useCallback, useEffect, useState } from "react";

// Cycle 29 — 시스템 홈(/home) 전용 사이드바.
// 페이지 트리·공간 도구 대신 시스템 수준의 발견/내 작업/내 공간 섹션 anchor.

type Section = { id: string; icon: string; label: string };

const SECTIONS: Section[] = [
  { id: "discover", icon: "🧭", label: "발견" },
  { id: "mywork", icon: "💼", label: "내 작업" },
  { id: "recent", icon: "🕘", label: "최근 방문" },
  { id: "saved", icon: "⭐", label: "나중을 위해 저장" },
  { id: "spaces", icon: "🌐", label: "내 공간" },
];

export default function SystemSidebar() {
  const [active, setActive] = useState<string>("discover");

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(id);
    }
  }, []);

  // 스크롤 시 viewport에 들어온 섹션 자동 강조. IntersectionObserver.
  // 셸 layout이 <main overflow-auto>를 스크롤 컨테이너로 쓰므로 root를 main으로.
  useEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root, rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <aside className="w-[260px] shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] h-full overflow-y-auto flex flex-col">
      <div className="px-4 py-3 border-b border-[#dfe1e6]">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
          시스템 홈
        </div>
        <div className="text-sm font-semibold text-[#172b4d] mt-0.5">
          내 워크스페이스
        </div>
      </div>

      <nav className="px-2 py-2 space-y-0.5">
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm text-left ${
                isActive
                  ? "bg-[#deebff] text-[#0052cc] font-semibold"
                  : "text-[#172b4d] hover:bg-[#ebecf0]"
              }`}
            >
              <span className="w-4 text-center">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#dfe1e6] mx-2 my-1" />

      <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
        도움말
      </div>
      <div className="px-2 pb-4 text-[12px] text-[#6b778c]">
        <div className="px-3 py-1">사이드바의 항목을 클릭하면 해당 섹션으로 스크롤됩니다.</div>
      </div>
    </aside>
  );
}
