"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppIcon from "@/components/AppIcon";
import UserSearchCombobox from "@/components/UserSearchCombobox";
import type {
  PageRestrictionMode,
  PageRestrictionRole,
  PageRestrictionState,
} from "@/lib/types";

// Cycle 83 — 페이지 단위 제한 버튼.
//   3 모드: 제한 없음 / 편집 제한 / 보기 및 편집 제한.
//   - 제한 없음: 공간 권한을 그대로 따름. unlock 표시.
//   - 편집 제한: 모두 보기 가능, 일부 사용자만 편집. unlock 표시.
//   - 보기 및 편집 제한: 일부 사용자만 보기/편집. lock(빨강) 표시.
//   pageId 가 없으면 placeholder.

const MODE_OPTIONS: {
  value: PageRestrictionMode;
  label: string;
  description: string;
}[] = [
  {
    value: "NONE",
    label: "제한 없음",
    description: "모두가 보고 편집할 수 있습니다.",
  },
  {
    value: "EDIT",
    label: "편집 제한",
    description: "모두가 볼 수 있으나 일부 사용자만 편집이 가능합니다.",
  },
  {
    value: "VIEW_EDIT",
    label: "보기 및 편집 제한",
    description: "일부 사용자만 보거나 편집할 수 있습니다.",
  },
];

// lock.png 를 빨간색으로 mask-tint (PNG 원본 색에 무관).
function RedLockIcon({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: "#de350b",
        WebkitMaskImage: "url(/icons/lock.png)",
        maskImage: "url(/icons/lock.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

export default function RestrictButton({ pageId }: { pageId?: string }) {
  if (!pageId) return <PlaceholderRestrictButton />;
  return <RealRestrictButton pageId={pageId} />;
}

function PlaceholderRestrictButton() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] text-[#a5adba]">
      <AppIcon name="unlock" size={14} alt="제한" />
      제한
    </span>
  );
}

function RealRestrictButton({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addRole, setAddRole] = useState<PageRestrictionRole>("VIEW");
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const queryKey = ["page-restriction", pageId];
  const { data, isLoading } = useQuery<PageRestrictionState>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/pages/${pageId}/restriction`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as PageRestrictionState;
    },
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const mode = data?.mode ?? "NONE";
  const canManage = data?.canManage ?? false;
  const members = data?.members ?? [];
  const isLocked = mode === "VIEW_EDIT";

  // 사용자 추가 UI 열릴 때 모드에 맞게 기본 역할 설정.
  useEffect(() => {
    if (adding) setAddRole(mode === "EDIT" ? "EDIT" : "VIEW");
  }, [adding, mode]);

  const setMode = useMutation({
    mutationFn: async (next: PageRestrictionMode) => {
      const r = await fetch(`/api/pages/${pageId}/restriction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: next }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => window.alert("제한 모드 변경에 실패했습니다."),
  });

  const addMember = useMutation({
    mutationFn: async (v: { userId: string; role: PageRestrictionRole }) => {
      const r = await fetch(`/api/pages/${pageId}/restriction/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(v),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => window.alert("사용자 추가에 실패했습니다."),
  });

  const changeMemberRole = useMutation({
    mutationFn: async (v: { userId: string; role: PageRestrictionRole }) => {
      const r = await fetch(
        `/api/pages/${pageId}/restriction/members/${v.userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: v.role }),
        },
      );
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => window.alert("역할 변경에 실패했습니다."),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(
        `/api/pages/${pageId}/restriction/members/${userId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => window.alert("사용자 제거에 실패했습니다."),
  });

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="페이지 제한"
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] hover:bg-[#ebecf0] ${
          isLocked ? "text-[#de350b] font-semibold" : "text-[#42526e]"
        }`}
      >
        {isLocked ? (
          <RedLockIcon size={14} />
        ) : (
          <AppIcon name="unlock" size={14} alt="제한" />
        )}
        <span>제한</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-80 bg-white border border-[#dfe1e6] rounded-md shadow-lg p-3 text-[12px]">
          {isLoading ? (
            <div className="text-[#6b778c]">불러오는 중...</div>
          ) : (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6b778c] mb-2">
                페이지 제한
              </div>
              <div className="space-y-1.5">
                {MODE_OPTIONS.map((opt) => {
                  const active = mode === opt.value;
                  const disabled = !canManage || setMode.isPending;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (!canManage || active) return;
                        setMode.mutate(opt.value);
                      }}
                      className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                        active
                          ? "border-[#0052cc] bg-[#deebff]"
                          : "border-[#dfe1e6] hover:bg-[#f4f5f7]"
                      } ${!canManage ? "opacity-70 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        {opt.value === "VIEW_EDIT" ? (
                          <RedLockIcon size={14} />
                        ) : (
                          <AppIcon name="unlock" size={14} alt="" />
                        )}
                        <span
                          className={`font-semibold ${
                            opt.value === "VIEW_EDIT"
                              ? "text-[#de350b]"
                              : "text-[#172b4d]"
                          }`}
                        >
                          {opt.label}
                        </span>
                        {active && (
                          <span className="ml-auto text-[#0052cc]">✓</span>
                        )}
                      </div>
                      <div className="text-[#6b778c] mt-1">
                        {opt.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {(mode === "EDIT" || mode === "VIEW_EDIT") && (
                <div className="mt-3 pt-3 border-t border-[#dfe1e6]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
                      허용 사용자
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setAdding((v) => !v)}
                        className="text-[11px] text-[#0052cc] hover:underline"
                      >
                        {adding ? "닫기" : "+ 사용자 추가"}
                      </button>
                    )}
                  </div>
                  {adding && canManage && (
                    <div className="mb-2 relative">
                      {mode === "VIEW_EDIT" && (
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[11px] text-[#6b778c]">
                            역할:
                          </span>
                          <button
                            type="button"
                            onClick={() => setAddRole("VIEW")}
                            className={`px-1.5 py-0.5 text-[11px] rounded ${
                              addRole === "VIEW"
                                ? "bg-[#deebff] text-[#0052cc] font-semibold"
                                : "text-[#42526e] hover:bg-[#f4f5f7]"
                            }`}
                          >
                            보기
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddRole("EDIT")}
                            className={`px-1.5 py-0.5 text-[11px] rounded ${
                              addRole === "EDIT"
                                ? "bg-[#deebff] text-[#0052cc] font-semibold"
                                : "text-[#42526e] hover:bg-[#f4f5f7]"
                            }`}
                          >
                            조회+편집
                          </button>
                        </div>
                      )}
                      <UserSearchCombobox
                        excludeIds={members.map((m) => m.userId)}
                        onSelect={(u) => {
                          addMember.mutate({ userId: u.id, role: addRole });
                          setAdding(false);
                        }}
                        onClose={() => setAdding(false)}
                      />
                    </div>
                  )}
                  {members.length === 0 ? (
                    <div className="text-[#6b778c] text-[11px]">
                      아직 추가된 사용자가 없습니다.
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {members.map((m) => (
                        <li
                          key={m.userId}
                          className="flex items-center gap-2 py-1 text-[12px]"
                        >
                          <span className="flex-1 truncate text-[#172b4d]">
                            {m.name}
                            {m.department && (
                              <span className="text-[#a5adba] text-[11px] ml-1">
                                ({m.department})
                              </span>
                            )}
                          </span>
                          {mode === "VIEW_EDIT" ? (
                            <select
                              value={m.role}
                              disabled={
                                !canManage || changeMemberRole.isPending
                              }
                              onChange={(e) =>
                                changeMemberRole.mutate({
                                  userId: m.userId,
                                  role: e.target.value as PageRestrictionRole,
                                })
                              }
                              className="text-[11px] border border-[#dfe1e6] rounded px-1 py-0.5"
                            >
                              <option value="VIEW">보기</option>
                              <option value="EDIT">조회+편집</option>
                            </select>
                          ) : (
                            <span className="text-[11px] text-[#0052cc] font-medium">
                              {m.role === "EDIT" ? "편집" : "보기"}
                            </span>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => removeMember.mutate(m.userId)}
                              className="text-[#6b778c] hover:text-[#de350b] text-[14px] leading-none"
                              title="제거"
                              aria-label={`${m.name} 제거`}
                            >
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {!canManage && (
                <div className="mt-2 text-[11px] text-[#a5adba]">
                  제한 변경 권한이 없습니다 (페이지 작성자 또는 공간 관리자만).
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
