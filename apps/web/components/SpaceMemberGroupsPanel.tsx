"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SpaceRole } from "@/lib/types";

// Cycle L7 (feature/ldh) — 공간 도구 '권한' 탭의 그룹 섹션. 개인 멤버 패널과 나란히.
//   그룹에 부여한 역할은 개인 멤버십과 max 결합된다(높은 쪽 승리, 그룹이 강등 못 함).
type GroupGrant = {
  groupId: string;
  role: SpaceRole;
  createdAt: string;
  group: {
    id: string;
    name: string;
    source: "LOCAL" | "KEYCLOAK";
    _count: { members: number };
  };
};

type GroupOption = {
  id: string;
  name: string;
  source: "LOCAL" | "KEYCLOAK";
};

const ROLES: SpaceRole[] = ["ADMIN", "EDITOR", "VIEWER"];
const ROLE_LABEL: Record<SpaceRole, string> = {
  ADMIN: "관리자",
  EDITOR: "편집자",
  VIEWER: "뷰어",
};

export default function SpaceMemberGroupsPanel({
  spaceId,
}: {
  spaceId: string;
}) {
  const qc = useQueryClient();
  const [addGroupId, setAddGroupId] = useState("");
  const [addRole, setAddRole] = useState<SpaceRole>("EDITOR");

  const { data: grants } = useQuery<GroupGrant[]>({
    queryKey: ["space-member-groups", spaceId],
    queryFn: async () => {
      const r = await fetch(`/api/spaces/${spaceId}/member-groups`, {
        credentials: "include",
      });
      return r.ok ? ((await r.json()) as GroupGrant[]) : [];
    },
  });

  const { data: allGroups } = useQuery<GroupOption[]>({
    queryKey: ["groups-directory"],
    queryFn: async () => {
      const r = await fetch("/api/groups", { credentials: "include" });
      return r.ok ? ((await r.json()) as GroupOption[]) : [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["space-member-groups", spaceId] });
    qc.invalidateQueries({ queryKey: ["spaces"] });
  };

  const add = useMutation({
    mutationFn: async (v: { groupId: string; role: SpaceRole }) => {
      const r = await fetch(`/api/spaces/${spaceId}/member-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(v),
      });
      if (!r.ok) throw new Error("add failed");
    },
    onSuccess: () => {
      setAddGroupId("");
      invalidate();
    },
    onError: () => window.alert("그룹 권한 추가에 실패했습니다."),
  });

  const changeRole = useMutation({
    mutationFn: async (v: { groupId: string; role: SpaceRole }) => {
      const r = await fetch(
        `/api/spaces/${spaceId}/member-groups/${v.groupId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: v.role }),
        },
      );
      if (!r.ok) throw new Error("patch failed");
    },
    onSuccess: invalidate,
    onError: () => window.alert("역할 변경에 실패했습니다."),
  });

  const remove = useMutation({
    mutationFn: async (groupId: string) => {
      const r = await fetch(
        `/api/spaces/${spaceId}/member-groups/${groupId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!r.ok) throw new Error("delete failed");
    },
    onSuccess: invalidate,
    onError: () => window.alert("그룹 권한 제거에 실패했습니다."),
  });

  const list = grants ?? [];
  const assignedIds = new Set(list.map((g) => g.groupId));
  const options = (allGroups ?? []).filter((g) => !assignedIds.has(g.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] text-[#6b778c]">그룹 권한 추가</span>
        <select
          value={addGroupId}
          onChange={(e) => setAddGroupId(e.target.value)}
          className="px-2 py-1 text-[13px] border border-[#dfe1e6] rounded min-w-[140px]"
        >
          <option value="">그룹 선택...</option>
          {options.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.source === "KEYCLOAK" ? " (Keycloak)" : ""}
            </option>
          ))}
        </select>
        <select
          value={addRole}
          onChange={(e) => setAddRole(e.target.value as SpaceRole)}
          className="px-2 py-1 text-[13px] border border-[#dfe1e6] rounded"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!addGroupId || add.isPending}
          onClick={() => add.mutate({ groupId: addGroupId, role: addRole })}
          className="px-2 py-1 text-[13px] rounded border border-[#0052cc] text-[#0052cc] hover:bg-[#f4f8ff] disabled:border-[#dfe1e6] disabled:text-[#a5adba]"
        >
          추가
        </button>
      </div>

      {list.length === 0 ? (
        <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
          이 공간에 부여된 그룹 권한이 없습니다. 그룹을 추가하면 그룹 멤버
          전원이 해당 역할(개인 권한과 높은 쪽)로 이 공간에 접근합니다.
        </div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-[#6b778c] border-b border-[#dfe1e6]">
              <th className="py-2 font-semibold">그룹</th>
              <th className="font-semibold">멤버 수</th>
              <th className="font-semibold">역할</th>
              <th className="font-semibold">추가일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.groupId} className="border-b border-[#f4f5f7]">
                <td className="py-2 text-[#172b4d]">
                  {g.group.name}
                  {g.group.source === "KEYCLOAK" && (
                    <span className="text-[11px] text-[#0747a6] ml-2">
                      Keycloak
                    </span>
                  )}
                </td>
                <td className="text-[#6b778c]">{g.group._count.members}</td>
                <td>
                  <select
                    value={g.role}
                    onChange={(e) =>
                      changeRole.mutate({
                        groupId: g.groupId,
                        role: e.target.value as SpaceRole,
                      })
                    }
                    className="px-1.5 py-1 text-[12px] border border-[#dfe1e6] rounded"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="text-[#6b778c]">
                  {new Date(g.createdAt).toLocaleDateString("ko-KR")}
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `'${g.group.name}' 그룹의 권한을 제거할까요?`,
                        )
                      ) {
                        remove.mutate(g.groupId);
                      }
                    }}
                    className="text-[12px] text-[#bf2600] hover:underline"
                  >
                    제거
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
