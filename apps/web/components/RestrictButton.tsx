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
  PageRestrictionGroup,
  PageRestrictionMember,
  PageRestrictionMode,
  PageRestrictionRole,
  PageRestrictionState,
} from "@/lib/types";

// Cycle L7-2 — 그룹 선택용 디렉터리(GET /api/groups, 인증 사용자 누구나).
type GroupOption = { id: string; name: string };

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
  // Cycle 83 followup 3 — 모든 변경은 로컬 draft. '적용' 시 한 번에 PATCH.
  const [draftMode, setDraftMode] = useState<PageRestrictionMode>("NONE");
  const [draftMembers, setDraftMembers] = useState<PageRestrictionMember[]>([]);
  // Cycle L7-2 — 그룹 제한 멤버 draft + 추가 UI 상태/역할.
  const [draftGroups, setDraftGroups] = useState<PageRestrictionGroup[]>([]);
  const [addingGroup, setAddingGroup] = useState(false);
  const [addGroupRole, setAddGroupRole] = useState<PageRestrictionRole>("VIEW");
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

  // Cycle L7-2 — 그룹 디렉터리(다이얼로그 열릴 때만 조회). 그룹 선택 드롭다운용.
  const { data: allGroups } = useQuery<GroupOption[]>({
    queryKey: ["groups-directory"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/groups", { credentials: "include" });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as GroupOption[];
    },
  });

  // 다이얼로그 열릴 때 서버 상태로 draft 초기화. 닫힐 때 보조 상태 정리.
  useEffect(() => {
    if (open && data) {
      setDraftMode(data.mode);
      setDraftMembers(data.members);
      setDraftGroups(data.groups);
      setMemberPage(0);
    }
    if (!open) {
      setAdding(false);
      setAddingGroup(false);
    }
  }, [open, data]);

  const canManage = data?.canManage ?? false;
  const serverMode = data?.mode ?? "NONE";
  // 트리거 아이콘은 서버 상태 기준(draft 는 다이얼로그 안에서만 의미).
  const isLocked = serverMode === "VIEW_EDIT";

  // 사용자 추가 UI 열릴 때 모드에 맞게 기본 역할 설정.
  useEffect(() => {
    if (adding) setAddRole(draftMode === "EDIT" ? "EDIT" : "VIEW");
  }, [adding, draftMode]);

  // Cycle L7-2 — 그룹 추가 UI 열릴 때도 모드에 맞게 기본 역할.
  useEffect(() => {
    if (addingGroup) setAddGroupRole(draftMode === "EDIT" ? "EDIT" : "VIEW");
  }, [addingGroup, draftMode]);

  // 아직 추가되지 않은 그룹만 드롭다운에 노출.
  const availableGroups = (allGroups ?? []).filter(
    (g) => !draftGroups.some((d) => d.groupId === g.id),
  );

  // 페이지네이션 계산 (draft 기준).
  const totalPages = Math.max(
    1,
    Math.ceil(draftMembers.length / MEMBERS_PER_PAGE),
  );
  const safeMemberPage = Math.min(memberPage, totalPages - 1);
  const pageMembers = draftMembers.slice(
    safeMemberPage * MEMBERS_PER_PAGE,
    (safeMemberPage + 1) * MEMBERS_PER_PAGE,
  );

  // 모드 카드 클릭 → draft 모드 변경 + 멤버 초기화(역할 의미 달라짐).
  const selectMode = (next: PageRestrictionMode) => {
    if (next === draftMode) return;
    setDraftMode(next);
    setDraftMembers([]);
    setDraftGroups([]);
    setMemberPage(0);
    setAdding(false);
    setAddingGroup(false);
  };

  const apply = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/pages/${pageId}/restriction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: draftMode,
          members: draftMembers.map((m) => ({
            userId: m.userId,
            role: m.role,
          })),
          groups: draftGroups.map((g) => ({
            groupId: g.groupId,
            role: g.role,
          })),
        }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setOpen(false);
    },
    onError: () => window.alert("저장에 실패했습니다."),
  });

  // draft 와 서버 상태가 동일한지(변경사항 없음 → '적용' 비활성용).
  const isDirty =
    !!data &&
    (draftMode !== data.mode ||
      draftMembers.length !== data.members.length ||
      draftMembers.some((d) => {
        const s = data.members.find((sm) => sm.userId === d.userId);
        return !s || s.role !== d.role;
      }) ||
      // Cycle L7-2 — 그룹 변경도 dirty 로 감지.
      draftGroups.length !== data.groups.length ||
      draftGroups.some((d) => {
        const s = data.groups.find((sg) => sg.groupId === d.groupId);
        return !s || s.role !== d.role;
      }));

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
                  const active = draftMode === opt.value;
                  const disabled = !canManage || apply.isPending;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (!canManage) return;
                        selectMode(opt.value);
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

              {(draftMode === "EDIT" || draftMode === "VIEW_EDIT") && (
                <div className="mt-3 pt-3 border-t border-[#dfe1e6] flex-1 min-h-0 flex flex-col">
                  {/* Cycle L7-2 — 허용 그룹(개인 사용자와 별개로 결합, 역할 max). */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
                        허용 그룹
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setAddingGroup((v) => !v)}
                          className="text-[11px] text-[#0052cc] hover:underline"
                        >
                          {addingGroup ? "닫기" : "+ 그룹 추가"}
                        </button>
                      )}
                    </div>
                    {addingGroup && canManage && (
                      <div className="mb-2 flex items-center gap-1.5">
                        {draftMode === "VIEW_EDIT" && (
                          <select
                            value={addGroupRole}
                            onChange={(e) =>
                              setAddGroupRole(
                                e.target.value as PageRestrictionRole,
                              )
                            }
                            className="text-[11px] border border-[#dfe1e6] rounded px-1 py-1"
                          >
                            <option value="VIEW">보기</option>
                            <option value="EDIT">조회+편집</option>
                          </select>
                        )}
                        <select
                          value=""
                          onChange={(e) => {
                            const g = availableGroups.find(
                              (x) => x.id === e.target.value,
                            );
                            if (!g) return;
                            setDraftGroups((prev) => [
                              ...prev,
                              {
                                groupId: g.id,
                                name: g.name,
                                role:
                                  draftMode === "EDIT" ? "EDIT" : addGroupRole,
                              },
                            ]);
                            setAddingGroup(false);
                          }}
                          className="flex-1 text-[12px] border border-[#dfe1e6] rounded px-1.5 py-1"
                        >
                          <option value="" disabled>
                            {availableGroups.length === 0
                              ? "추가할 그룹이 없습니다"
                              : "그룹 선택..."}
                          </option>
                          {availableGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {draftGroups.length === 0 ? (
                      <div className="text-[#6b778c] text-[11px]">
                        추가된 그룹이 없습니다.
                      </div>
                    ) : (
                      <ul className="space-y-1 max-h-[5.5rem] overflow-y-auto">
                        {draftGroups.map((g) => (
                          <li
                            key={g.groupId}
                            className="flex items-center gap-2 py-0.5 text-[12px]"
                          >
                            <span className="px-1 rounded bg-[#eae6ff] text-[#5243aa] text-[10px] font-semibold shrink-0">
                              그룹
                            </span>
                            <span className="flex-1 truncate text-[#172b4d]">
                              {g.name}
                            </span>
                            {draftMode === "VIEW_EDIT" ? (
                              <select
                                value={g.role}
                                disabled={!canManage}
                                onChange={(e) => {
                                  const role = e.target
                                    .value as PageRestrictionRole;
                                  setDraftGroups((prev) =>
                                    prev.map((x) =>
                                      x.groupId === g.groupId
                                        ? { ...x, role }
                                        : x,
                                    ),
                                  );
                                }}
                                className="text-[11px] border border-[#dfe1e6] rounded px-1 py-0.5"
                              >
                                <option value="VIEW">보기</option>
                                <option value="EDIT">조회+편집</option>
                              </select>
                            ) : (
                              <span className="text-[11px] text-[#0052cc] font-medium">
                                {g.role === "EDIT" ? "편집" : "보기"}
                              </span>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftGroups((prev) =>
                                    prev.filter(
                                      (x) => x.groupId !== g.groupId,
                                    ),
                                  )
                                }
                                className="text-[#6b778c] hover:text-[#de350b] text-[14px] leading-none"
                                title="제거"
                                aria-label={`${g.name} 제거`}
                              >
                                ×
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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
                      {draftMode === "VIEW_EDIT" && (
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
                        excludeIds={draftMembers.map((m) => m.userId)}
                        onSelect={(u) => {
                          setDraftMembers((prev) => [
                            ...prev,
                            {
                              userId: u.id,
                              name: u.name,
                              department: u.department ?? null,
                              role:
                                draftMode === "EDIT" ? "EDIT" : addRole,
                            },
                          ]);
                          // 새 멤버가 추가되면 마지막 페이지로 이동.
                          setMemberPage(
                            Math.floor(
                              draftMembers.length / MEMBERS_PER_PAGE,
                            ),
                          );
                          setAdding(false);
                        }}
                        onClose={() => setAdding(false)}
                      />
                    </div>
                  )}
                  {/* 페이지네이션으로 고정 영역 — 멤버 추가로 다이얼로그가 커지지 않도록. */}
                  <div className="flex-1 min-h-0 flex flex-col">
                    {draftMembers.length === 0 ? (
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
                            {draftMode === "VIEW_EDIT" ? (
                              <select
                                value={m.role}
                                disabled={!canManage}
                                onChange={(e) => {
                                  const role = e.target
                                    .value as PageRestrictionRole;
                                  setDraftMembers((prev) =>
                                    prev.map((x) =>
                                      x.userId === m.userId ? { ...x, role } : x,
                                    ),
                                  );
                                }}
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
                                onClick={() =>
                                  setDraftMembers((prev) =>
                                    prev.filter((x) => x.userId !== m.userId),
                                  )
                                }
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
                    {draftMembers.length > MEMBERS_PER_PAGE && (
                      <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-[#6b778c]">
                        <span>
                          {draftMembers.length}명 · {safeMemberPage + 1}/
                          {totalPages}
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
          {/* Cycle 83 followup 3 — 명시적 적용/취소 버튼. 닫기만으론 저장 안 됨. */}
          <div className="flex justify-end gap-2 pt-3 border-t border-[#dfe1e6]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#ebecf0]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => apply.mutate()}
              disabled={!canManage || !isDirty || apply.isPending}
              className="px-3 py-1.5 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
            >
              {apply.isPending ? "적용 중..." : "적용"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
