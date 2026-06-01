"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SpaceWithPages } from "@/lib/types";
import { useAuth } from "@/lib/auth/useAuth";
import { useRecentSpacesStore } from "@/lib/stores/useRecentSpacesStore";
import { getSpaceHomePageId } from "@/lib/spaceHome";
import SearchOverlay from "@/components/SearchOverlay";
import SpaceAvatar from "@/components/SpaceAvatar";
import CreatePageDialog from "@/components/CreatePageDialog";
import NotificationBellButton from "@/components/NotificationBellButton";
import AppIcon from "@/components/AppIcon";

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
  // Cycle 31 — 검색 오버레이. 검색창 클릭 또는 Ctrl/Cmd+K 로 열림.
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="relative z-50 h-14 shrink-0 flex items-center gap-4 px-4 bg-white border-b border-[#dfe1e6]">
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
        {/* 달력 — 일정 관리 캘린더 뷰. 추후 구현 예정. */}
        <button
          type="button"
          disabled
          title="달력 기능은 추후 제공 예정입니다."
          className="px-3 py-1.5 rounded text-[#a5adba] cursor-not-allowed"
        >
          달력
        </button>
      </nav>

      <CreateSplitButton spaces={spaces} />

      <div className="flex-1" />

      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <AppIcon name="search" size={14} alt="" />
        </span>
        {/* Cycle 31 — readOnly 트리거. 클릭/포커스 시 SearchOverlay 열림. */}
        <input
          type="text"
          readOnly
          placeholder="검색 (Ctrl+K)"
          onClick={() => setSearchOpen(true)}
          onFocus={() => setSearchOpen(true)}
          className="w-60 pl-8 pr-3 py-1.5 text-sm bg-[#f4f5f7] border border-transparent rounded cursor-pointer hover:bg-white hover:border-[#dfe1e6] focus:outline-none"
        />
      </div>

      <NotificationBellButton />
      <AdminGearButton />
      <UserMenu />

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

// Cycle 48 — 톱니바퀴(관리자 페이지 진입). ADMIN role 사용자만 노출 — DOM 미생성.
// 권한 source: useAuth().user.role 은 OIDC callback 에서 Keycloak realm role 로
// 매 로그인마다 동기화된다. 백엔드도 동일 가드(RolesGuard) 적용 — 이중 가드.
// Cycle 48 followup — 단순 진입 버튼에서 드롭다운 트리거로 변경. UserMenu 패턴
// 답습(useRef + mousedown 외부 클릭 닫기, Esc keydown 닫기). 항목 클릭 시 /admin
// 으로 ?tab 쿼리와 함께 이동 — /admin 페이지가 useSearchParams 로 초기 탭 결정.
function AdminGearButton() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (user?.role !== "ADMIN") return null;

  const go = (tab: "general" | "users") => {
    setOpen(false);
    router.push(`/admin?tab=${tab}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="관리자 메뉴"
        title="관리자 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`w-8 h-8 flex items-center justify-center rounded-full text-[#42526e] ${
          open ? "bg-[#ebecf0]" : "hover:bg-[#ebecf0]"
        }`}
      >
        <AppIcon name="settings" size={16} alt="관리자" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#dfe1e6] rounded shadow-lg z-30 py-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => go("general")}
            className="w-full text-left px-3 py-2 text-[13px] text-[#172b4d] hover:bg-[#f4f5f7]"
          >
            일반 설정
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => go("users")}
            className="w-full text-left px-3 py-2 text-[13px] text-[#172b4d] hover:bg-[#f4f5f7]"
          >
            사용자 관리
          </button>
        </div>
      )}
    </div>
  );
}

// FR-001 (Cycle 27b) — 로그인한 사용자 메뉴. 미로그인 시 "로그인" 링크.
// Cycle 49 — '내 개인 공간' 진입 항목 추가(정보 블록 다음·로그아웃 위).
function UserMenu() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // ['spaces'] 캐시 공유 — 다른 곳에서 이미 호출 중이라 추가 fetch 없음(보통).
  const { data: spacesData } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
    enabled: !!user,
  });

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

  // Cycle 43 followup — 로그아웃은 단일 로그아웃(SLO). Keycloak end_session 까지
  // 타야 하므로 fetch 가 아니라 top-level 네비게이션으로 진입한다. 서버가 로컬
  // 쿠키를 클리어하고 Keycloak 으로 redirect → SSO 세션 종료 후 /login 으로 복귀.
  const handleLogout = () => {
    window.location.href = "/api/auth/oidc/logout";
  };

  // Cycle 49 — '내 개인 공간' 진입. spacesData 캐시에서 본인 personal space 찾고,
  // 없으면 GET /api/spaces/personal 로 lazy 보장(OIDC callback 자동 생성 직후라
  // 보통 캐시에 있음 — 이건 안전망).
  const handleGoPersonal = async () => {
    setOpen(false);
    if (!user) return;
    const fromCache = spacesData?.find(
      (s) => s.type === "PERSONAL" && s.ownerId === user.id,
    );
    const enter = (sp: SpaceWithPages) => {
      const homeId = getSpaceHomePageId(sp);
      router.push(homeId ? `/?pageId=${homeId}` : `/?spaceId=${sp.id}`);
    };
    if (fromCache) {
      enter(fromCache);
      return;
    }
    try {
      const r = await fetch("/api/spaces/personal", {
        credentials: "include",
      });
      if (!r.ok) {
        window.alert("개인 공간을 준비하지 못했습니다.");
        return;
      }
      enter((await r.json()) as SpaceWithPages);
    } catch {
      window.alert("개인 공간을 준비하지 못했습니다.");
    }
  };

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
          {/* Cycle 49 — '내 개인 공간' 진입 (사이드바 토글 상태와 무관). */}
          <button
            type="button"
            onClick={() => {
              void handleGoPersonal();
            }}
            className="w-full text-left px-3 py-2 text-[13px] text-[#172b4d] hover:bg-[#f4f5f7]"
          >
            내 개인 공간
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              handleLogout();
            }}
            className="w-full text-left px-3 py-2 text-[13px] text-[#de350b] hover:bg-[#ffebe6] border-t border-[#dfe1e6]"
          >
            로그아웃
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
                  <SpaceAvatar name={s.name} icon={s.icon} size={24} />
                  <span className="flex-1 min-w-0 truncate font-medium">
                    {s.name}
                  </span>
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

// Cycle 32 — 분할 "만들기" 버튼. 좌측 main = 컨텍스트 기반 빠른 페이지 생성,
// Cycle 80 — 우측 ⋯ = '만들기' 모달(빈 페이지 카드, 향후 템플릿).
function CreateSplitButton({ spaces }: { spaces: SpaceWithPages[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // 현재 컨텍스트로 타깃 스페이스/부모를 결정해 페이지를 즉시 생성하고
  // 편집 모드(?edit=1)로 진입한다.
  // Cycle 36-followup — 컨텍스트 분기 정리:
  //   /home                    → 개인 공간의 루트 (parentId=null)
  //   /?spaceId=X              → 공간 X의 루트 (parentId=null)
  //   /?pageId=공간X의 홈      → 공간 X의 루트 (parentId=null)
  //                              "공간에 진입한" 상태라 그 공간에 새 페이지를 추가.
  //   /?pageId=일반페이지P     → P의 자식 (parentId=P)
  //   그 외                     → 개인 공간 fallback
  const handleQuickCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      let spaceId: string | null = null;
      let parentId: string | null = null;

      if (pathname === "/") {
        const pageId = searchParams.get("pageId");
        const spaceIdParam = searchParams.get("spaceId");

        if (pageId) {
          const owner = spaces.find((s) =>
            s.pages.some((p) => p.id === pageId),
          );
          if (owner) {
            spaceId = owner.id;
            // 현재 페이지가 이 공간의 "홈 페이지"면 사용자는 공간 자체를
            // 보고 있는 것으로 간주 → 새 페이지는 공간 루트(홈의 형제)로.
            // 그 외 일반 페이지에서 누르면 자식으로 들어간다.
            parentId =
              owner.homePageId && owner.homePageId === pageId ? null : pageId;
          }
        } else if (spaceIdParam) {
          spaceId = spaceIdParam;
          parentId = null;
        }
      }

      // 스페이스 컨텍스트가 없으면 내 개인 공간으로.
      if (!spaceId) {
        const pr = await fetch("/api/spaces/personal", {
          credentials: "include",
        });
        if (pr.status === 401) {
          alert("로그인이 필요합니다.");
          return;
        }
        if (!pr.ok) {
          alert("개인 공간을 준비하지 못했습니다.");
          return;
        }
        const personal = (await pr.json()) as { id: string };
        spaceId = personal.id;
        parentId = null;
      }

      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: "제목 없음",
          content: "",
          spaceId,
          parentId,
          // Cycle 35 — TopNav "만들기"는 draft로 시작. 사이드바 트리엔 안 보이고
          // 편집 창에서 [업데이트] 발행 시점에 등장한다(Confluence draft 모델).
          draft: true,
        }),
      });
      if (res.status === 401) {
        alert("로그인이 필요합니다.");
        return;
      }
      if (!res.ok) {
        alert("페이지 생성에 실패했습니다.");
        return;
      }
      const page = (await res.json()) as { id: string };
      // Cycle 35 — draft는 트리에 안 보이므로 spaces 캐시 invalidate는 사실상
      // no-op이지만, currentPage 라우팅이 spaces.pages 안에서 페이지를 찾을 수
      // 있어야 (?pageId=draftId 진입 시 activeSpace 결정) 캐시를 갱신해 둔다.
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      router.push(`/?pageId=${page.id}&edit=1`);
    } finally {
      setCreating(false);
      setMenuOpen(false);
    }
  };

  return (
    <div className="relative ml-2">
      <div className="inline-flex items-stretch rounded overflow-hidden">
        <button
          type="button"
          onClick={handleQuickCreate}
          disabled={creating}
          className="inline-flex items-center bg-[#0052cc] hover:bg-[#0747a6] text-white text-sm font-medium px-3 py-1.5 disabled:opacity-60"
        >
          {creating ? "생성 중..." : "만들기"}
        </button>
        <div className="w-px bg-[#ffffff44]" />
        <button
          type="button"
          aria-label="만들기 옵션"
          onClick={() => setMenuOpen(true)}
          className="px-2 bg-[#0052cc] hover:bg-[#0747a6] text-white text-sm"
        >
          ⋯
        </button>
      </div>
      {/* Cycle 80 — ⋯ → '만들기' 모달(빈 페이지 카드). */}
      <CreatePageDialog
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onSelectBlank={handleQuickCreate}
        creating={creating}
      />
    </div>
  );
}
