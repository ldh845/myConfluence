"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SpaceWithPages } from "@/lib/types";

type Props = {
  spaces: SpaceWithPages[];
  activeSpaceId: string | null;
  onSelectSpace: (id: string) => void;
  onCreateSpace: () => void;
};

export default function TopNav({
  spaces,
  activeSpaceId,
  onSelectSpace,
  onCreateSpace,
}: Props) {
  return (
    <header className="h-14 shrink-0 flex items-center gap-4 px-4 bg-white border-b border-[#dfe1e6]">
      {/* FR-130 (Cycle 22) — 로고 클릭 시 홈 대시보드로. */}
      <Link
        href="/home"
        className="flex items-center gap-2 pr-2 rounded hover:bg-[#ebecf0]"
        aria-label="홈으로"
      >
        <div className="w-7 h-7 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold text-sm">
          M
        </div>
        <span className="font-semibold text-[#172b4d]">
          my<span className="text-[#0052cc]">Confluence</span>
        </span>
      </Link>

      <nav className="flex items-center gap-1 text-sm text-[#172b4d]">
        <SpaceCombobox
          spaces={spaces}
          activeSpaceId={activeSpaceId}
          onSelectSpace={onSelectSpace}
          onCreateSpace={onCreateSpace}
        />
        <button className="px-3 py-1.5 rounded hover:bg-[#ebecf0]">
          페이지
        </button>
        <button className="px-3 py-1.5 rounded hover:bg-[#ebecf0]">
          최근 항목
        </button>
      </nav>

      <button className="ml-2 inline-flex items-center gap-1.5 bg-[#0052cc] hover:bg-[#0747a6] text-white text-sm font-medium px-3 py-1.5 rounded">
        <span className="text-base leading-none">＋</span>
        만들기
      </button>

      <div className="flex-1" />

      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b778c] text-sm">
          🔍
        </span>
        <input
          type="text"
          placeholder="검색"
          className="w-60 pl-8 pr-3 py-1.5 text-sm bg-[#f4f5f7] border border-transparent rounded focus:bg-white focus:border-[#0052cc] focus:outline-none"
        />
      </div>

      <button
        aria-label="설정"
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#ebecf0] text-[#42526e]"
      >
        ⚙️
      </button>
      <div
        aria-label="프로필"
        className="w-8 h-8 rounded-full bg-[#0052cc] text-white flex items-center justify-center text-xs font-semibold"
      >
        U
      </div>
    </header>
  );
}

function SpaceCombobox({
  spaces,
  activeSpaceId,
  onSelectSpace,
  onCreateSpace,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const activeName =
    spaces.find((s) => s.id === activeSpaceId)?.name ?? "공간";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded ${
          open ? "bg-[#ebecf0]" : "hover:bg-[#ebecf0]"
        }`}
      >
        <span>공간</span>
        <span className="text-[#6b778c] max-w-[140px] truncate">
          : {activeName}
        </span>
        <span className="text-[#6b778c] text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-[#dfe1e6] rounded shadow-lg z-30 py-1">
          <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
            내 공간
          </div>
          <div className="max-h-72 overflow-y-auto">
            {spaces.length === 0 && (
              <div className="px-3 py-2 text-sm text-[#6b778c]">
                공간이 없습니다.
              </div>
            )}
            {spaces.map((s) => {
              const active = s.id === activeSpaceId;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelectSpace(s.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                    active
                      ? "bg-[#deebff] text-[#0052cc]"
                      : "text-[#172b4d] hover:bg-[#ebecf0]"
                  }`}
                >
                  <div className="w-6 h-6 rounded bg-[#0052cc] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                    {s.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{s.name}</div>
                    {s.description && (
                      <div className="text-[11px] text-[#6b778c] truncate">
                        {s.description}
                      </div>
                    )}
                  </div>
                  {active && (
                    <span className="text-[#0052cc] text-xs">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-[#dfe1e6] mt-1" />
          <button
            onClick={() => {
              setOpen(false);
              onCreateSpace();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[#0052cc] hover:bg-[#deebff] font-medium"
          >
            <span className="text-base leading-none">＋</span>
            공간 만들기
          </button>
        </div>
      )}
    </div>
  );
}
