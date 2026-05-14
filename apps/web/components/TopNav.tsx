"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SpaceWithPages } from "@/lib/types";
import { useAuth } from "@/lib/auth/useAuth";
import { apiFetch } from "@/lib/api";
import { useRecentSpacesStore } from "@/lib/stores/useRecentSpacesStore";

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
      {/* FR-130 (Cycle 22) — 로고 클릭 시 홈으로. /home에 이미 있을 때도 full reload. */}
      <a
        href="/home"
        className="flex items-center gap-2 pr-2 rounded hover:bg-[#ebecf0]"
        aria-label="홈으로"
        onClick={(e) => {
          // Next Link 대신 <a> 사용 — 항상 full navigation 이므로 /home?view=X
          // 같은 상태가 깔끔히 리셋된다.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          window.location.href = "/home";
        }}
      >
        <div className="w-7 h-7 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold text-sm">
          M
        </div>
        <span className="font-semibold text-[#172b4d]">
          my<span className="text-[#0052cc]">Confluence</span>
        </span>
      </a>

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
      <UserMenu />
    </header>
  );
}

// FR-001 (Cycle 27b) — 로그인한 사용자 메뉴. 미로그인 시 "로그인" 링크.
function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
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

  const logout = useMutation<void, Error>({
    mutationFn: async () => {
      const r = await apiFetch("/api/auth/logout", { method: "POST" });
      if (!r.ok && r.status !== 204) throw new Error("로그아웃 실패");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace("/login");
    },
    onError: (err) => window.alert(err.message),
  });

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-[#dfe1e6] animate-pulse" />
    );
  }
  if (!user) {
    return (
      <Link
        href="/login"
        className="text-[13px] text-[#0052cc] hover:underline"
      >
        로그인
      </Link>
    );
  }

  const initial = user.name?.slice(0, 1).toUpperCase() ?? "U";
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 pr-2 rounded ${
          open ? "bg-[#ebecf0]" : "hover:bg-[#ebecf0]"
        }`}
      >
        <div
          aria-label="프로필"
          className="w-8 h-8 rounded-full bg-[#0052cc] text-white flex items-center justify-center text-xs font-semibold"
        >
          {initial}
        </div>
        <span className="text-sm text-[#172b4d] hidden sm:inline">
          {user.name}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-[#dfe1e6] rounded shadow-lg z-30 py-2">
          <div className="px-3 py-2 border-b border-[#dfe1e6]">
            <div className="text-[13px] font-semibold text-[#172b4d]">
              {user.name}
            </div>
            <div className="text-[11px] text-[#6b778c]">
              {user.department} · {user.role}
            </div>
            <div className="text-[11px] text-[#6b778c] mt-0.5">
              @{user.username}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout.mutate();
            }}
            disabled={logout.isPending}
            className="w-full text-left px-3 py-2 text-[13px] text-[#de350b] hover:bg-[#ffebe6] disabled:opacity-50"
          >
            {logout.isPending ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      )}
    </div>
  );
}

// Cycle 29 — 공간 드롭다운. 버튼은 "공간"만 표시.
// 드롭다운: "최근에 사용한 공간" 목록(최대 10) + "공간 목록"(/spaces) + "공간 만들기".
function SpaceCombobox({ spaces, onSelectSpace, onCreateSpace }: Props) {
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

  const recentEntries = useRecentSpacesStore((s) => s.entries);
  // 최근 사용 순서대로, 현재 존재하는 공간만 매핑.
  const recentSpaces = recentEntries
    .map((e) => spaces.find((s) => s.id === e.spaceId))
    .filter((s): s is SpaceWithPages => !!s)
    .slice(0, 10);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded ${
          open ? "bg-[#ebecf0]" : "hover:bg-[#ebecf0]"
        }`}
      >
        <span>공간</span>
        <span className="text-[#6b778c] text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-[#dfe1e6] rounded shadow-lg z-30 py-1">
          <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
            최근에 사용한 공간
          </div>
          <div className="max-h-72 overflow-y-auto">
            {recentSpaces.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[#6b778c]">
                최근 사용한 공간이 없습니다.
              </div>
            ) : (
              recentSpaces.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelectSpace(s.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[#172b4d] hover:bg-[#ebecf0]"
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
                </button>
              ))
            )}
          </div>

          <div className="border-t border-[#dfe1e6] mt-1" />
          <Link
            href="/spaces"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[#172b4d] hover:bg-[#ebecf0]"
          >
            <span className="w-4 text-center">🗂️</span>
            공간 목록
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              onCreateSpace();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[#0052cc] hover:bg-[#deebff] font-medium"
          >
            <span className="w-4 text-center text-base leading-none">＋</span>
            공간 만들기
          </button>
        </div>
      )}
    </div>
  );
}
