"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <span
      title="페이지 제한"
      className="inline-flex items-center px-2 py-1 rounded text-[#a5adba]"
    >
      <AppIcon name="unlock" size={14} alt="페이지 제한" />
    </span>
  );
}

// Cycle 83 followup — 멤버 목록은 페이지네이션(다이얼로그 크기 고정 유지).
const MEMBERS_PER_PAGE = 4;

function RealRestrictButton({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addRole, setAddRole] = useState<PageRestrictionRole>("VIEW");
  const [memberPage, setMemberPage] = useState(0);
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

  // 다이얼로그 닫힐 때 사용자 추가 UI 초기화.
  useEffect(() => {
    if (!open) setAdding(false);
  }, [open]);

  const mode = data?.mode ?? "NONE";
  const canManage = data?.canManage ?? false;
  const members = data?.members ?? [];
  const isLocked = mode === "VIEW_EDIT";

  // 사용자 추가 UI 열릴 때 모드에 맞게 기본 역할 설정.
  useEffect(() => {
    if (adding) setAddRole(mode === "EDIT" ? "EDIT" : "VIEW");
  }, [adding, mode]);

  // 모드 변경 시 페이지네이션 초기화.
  useEffect(() => {
    setMemberPage(0);
  }, [mode]);

  // 페이지네이션 계산.
  const totalPages = Math.max(1, Math.ceil(members.length / MEMBERS_PER_PAGE));
  const safeMemberPage = Math.min(memberPage, totalPages - 1);
  const pageMembers = members.slice(
    safeMemberPage * MEMBERS_PER_PAGE,
    (safeMemberPage + 1) * MEMBERS_PER_PAGE,
  );

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="페이지 제한"
        aria-label="페이지 제한"
        className="inline-flex items-center px-2 py-1 rounded hover:bg-[#ebecf0] shrink-0"
      >
        {isLocked ? (
          <RedLockIcon size={14} />
        ) : (
          <AppIcon name="unlock" size={14} alt="페이지 제한" />
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Cycle 83 followup — 폭/높이 고정으로 멤버 추가 시 크기 변동 방지. */}
        <DialogContent className="max-w-md w-[28rem] h-[34rem] flex flex-col">
          <DialogHeader>
            <DialogTitle>페이지 제한</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
          ) : (
            <div className="text-[12px] flex-1 min-h-0 flex flex-col">
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
                <div className="mt-3 pt-3 border-t border-[#dfe1e6] flex-1 min-h-0 flex flex-col">
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
                  {/* 페이지네이션으로 고정 영역 — 멤버 추가로 다이얼로그가 커지지 않도록. */}
                  <div className="flex-1 min-h-0 flex flex-col">
                    {members.length === 0 ? (
                      <div className="text-[#6b778c] text-[11px]">
                        아직 추가된 사용자가 없습니다.
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {pageMembers.map((m) => (
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
                    {members.length > MEMBERS_PER_PAGE && (
                      <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-[#6b778c]">
                        <span>
                          {members.length}명 · {safeMemberPage + 1}/{totalPages}
                        </span>
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setMemberPage((p) => Math.max(0, p - 1))
                            }
                            disabled={safeMemberPage === 0}
                            className="px-2 py-0.5 rounded border border-[#dfe1e6] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f4f5f7]"
                          >
                            이전
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMemberPage((p) =>
                                Math.min(totalPages - 1, p + 1),
                              )
                            }
                            disabled={safeMemberPage >= totalPages - 1}
                            className="px-2 py-0.5 rounded border border-[#dfe1e6] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f4f5f7]"
                          >
                            다음
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!canManage && (
                <div className="mt-2 text-[11px] text-[#a5adba]">
                  제한 변경 권한이 없습니다 (페이지 작성자 또는 공간 관리자만).
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
