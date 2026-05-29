"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import UserSearchCombobox from "./UserSearchCombobox";
import type { SpaceRole } from "@/lib/types";

// Cycle 74-C — 공간 도구 '권한' 탭. 멤버 목록 + 추가/역할변경/제거.
//   마지막 Admin 강등/제거는 서버가 400 으로 막고, 여기선 안내 메시지로 변환.
type Member = {
  userId: string;
  role: SpaceRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    department: string | null;
    email: string | null;
  };
};

const ROLES: SpaceRole[] = ["ADMIN", "EDITOR", "VIEWER"];
const ROLE_LABEL: Record<SpaceRole, string> = {
  ADMIN: "관리자",
  EDITOR: "편집자",
  VIEWER: "뷰어",
};

async function errMessage(r: Response): Promise<string> {
  const b = (await r.json().catch(() => ({}))) as { error?: string };
  return b?.error ?? "";
}

export default function SpaceMembersPanel({ spaceId }: { spaceId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [addRole, setAddRole] = useState<SpaceRole>("EDITOR");

  const { data: members } = useQuery<Member[]>({
    queryKey: ["space-members", spaceId],
    queryFn: async () => {
      const r = await fetch(`/api/spaces/${spaceId}/members`, {
        credentials: "include",
      });
      return r.ok ? ((await r.json()) as Member[]) : [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["space-members", spaceId] });
    // 내 역할이 바뀌면 사이드바 '공간 도구' 노출도 갱신.
    qc.invalidateQueries({ queryKey: ["spaces"] });
  };

  const addM = useMutation({
    mutationFn: async (u: { id: string; name: string }) => {
      const r = await fetch(`/api/spaces/${spaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: u.id, role: addRole }),
      });
      if (!r.ok) throw new Error("add failed");
    },
    onSuccess: invalidate,
    onError: () => window.alert("멤버 추가에 실패했습니다."),
  });

  const changeRole = useMutation({
    mutationFn: async (v: { userId: string; role: SpaceRole }) => {
      const r = await fetch(`/api/spaces/${spaceId}/members/${v.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: v.role }),
      });
      if (!r.ok) throw new Error(await errMessage(r));
    },
    onSuccess: invalidate,
    onError: (e: Error) =>
      window.alert(
        e.message.includes("last")
          ? "마지막 관리자는 강등할 수 없습니다."
          : "역할 변경에 실패했습니다.",
      ),
  });

  const removeM = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`/api/spaces/${spaceId}/members/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error(await errMessage(r));
    },
    onSuccess: invalidate,
    onError: (e: Error) =>
      window.alert(
        e.message.includes("last")
          ? "마지막 관리자는 제거할 수 없습니다."
          : "멤버 제거에 실패했습니다.",
      ),
  });

  const list = members ?? [];
  const existingIds = list.map((m) => m.userId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[#6b778c]">멤버 추가</span>
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="px-2 py-1 text-[13px] rounded border border-dashed border-[#c1c7d0] text-[#6b778c] hover:bg-[#f4f5f7]"
          >
            + 사용자 검색
          </button>
          {adding && (
            <UserSearchCombobox
              excludeIds={existingIds}
              onSelect={(u) => {
                addM.mutate(u);
                setAdding(false);
              }}
              onClose={() => setAdding(false)}
            />
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
          아직 멤버가 없습니다. 비공개(PRIVATE) 공간은 멤버만 접근할 수 있으니
          멤버를 추가하세요. (전역 관리자는 멤버가 아니어도 관리 가능)
        </div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-[#6b778c] border-b border-[#dfe1e6]">
              <th className="py-2 font-semibold">이름</th>
              <th className="font-semibold">부서</th>
              <th className="font-semibold">역할</th>
              <th className="font-semibold">추가일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.userId} className="border-b border-[#f4f5f7]">
                <td className="py-2 text-[#172b4d]">{m.user.name}</td>
                <td className="text-[#6b778c]">{m.user.department ?? "-"}</td>
                <td>
                  <select
                    value={m.role}
                    onChange={(e) =>
                      changeRole.mutate({
                        userId: m.userId,
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
                  {new Date(m.createdAt).toLocaleDateString("ko-KR")}
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `${m.user.name} 님을 멤버에서 제거할까요?`,
                        )
                      ) {
                        removeM.mutate(m.userId);
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
