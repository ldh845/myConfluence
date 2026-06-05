"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import UserSearchCombobox from "@/components/UserSearchCombobox";

// Cycle L6 (feature/ldh) — 관리자 '그룹' 탭. AdminUsers 패턴 재사용.
//   그룹 CRUD + 멤버 추가/제거. 권한 판정 연결은 L7 예고(여기선 '그릇'만).
//   source=KEYCLOAK 그룹은 수정·멤버 편집 비활성(서버도 403). 현재는 전부 로컬.

type Group = {
  id: string;
  name: string;
  description: string | null;
  source: "LOCAL" | "KEYCLOAK";
  memberCount: number;
  createdAt: string;
};

type GroupMember = {
  id: string;
  username: string;
  name: string;
  department: string;
  email: string | null;
  joinedAt: string;
};

export default function AdminGroups() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<Group[]>({
    queryKey: ["admin-groups"],
    queryFn: async () => {
      const r = await fetch("/api/admin/groups", { credentials: "include" });
      if (!r.ok) throw new Error("그룹 목록 조회 실패");
      return (await r.json()) as Group[];
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Group | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-groups"] });

  const remove = useMutation<void, Error, Group>({
    mutationFn: async (g) => {
      const r = await fetch(`/api/admin/groups/${g.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "그룹 삭제 실패");
      }
    },
    onSuccess: (_d, g) => {
      if (selected?.id === g.id) setSelected(null);
      refresh();
    },
    onError: (err) => window.alert(err.message),
  });

  const onDelete = (g: Group) => {
    if (
      !window.confirm(
        `'${g.name}' 그룹을 삭제하시겠습니까?\n그룹 멤버십이 함께 제거됩니다.`,
      )
    )
      return;
    remove.mutate(g);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#deebff] border border-[#b3d4ff] rounded-md p-4 text-[12px] text-[#172b4d]">
        <p className="font-semibold mb-1">그룹(부서/팀) 관리</p>
        <p className="text-[#42526e]">
          사용자를 그룹으로 묶어 둡니다. 그룹을 공간 권한·페이지 제한에 부여하는
          기능은 다음 단계에서 제공됩니다. Keycloak 에서 동기화된 그룹은 여기서
          수정할 수 없습니다.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-3 py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6]"
        >
          + 그룹 생성
        </button>
      </div>

      <div className="bg-white border border-[#dfe1e6] rounded-md overflow-hidden">
        {isLoading && (
          <div className="p-6 text-[13px] text-[#6b778c]">불러오는 중...</div>
        )}
        {error && (
          <div className="p-6 text-[13px] text-[#de350b]">
            {(error as Error).message}
          </div>
        )}
        {data && data.length === 0 && (
          <div className="p-6 text-[13px] text-[#6b778c]">그룹이 없습니다.</div>
        )}
        {data && data.length > 0 && (
          <table className="w-full text-[13px]">
            <thead className="bg-[#f4f5f7] text-[11px] uppercase text-[#6b778c]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">이름</th>
                <th className="px-3 py-2 text-left font-semibold">유형</th>
                <th className="px-3 py-2 text-left font-semibold">멤버</th>
                <th className="px-3 py-2 text-right font-semibold">관리</th>
              </tr>
            </thead>
            <tbody>
              {data.map((g) => {
                const isKc = g.source === "KEYCLOAK";
                return (
                  <tr key={g.id} className="border-t border-[#dfe1e6]">
                    <td className="px-3 py-2 text-[#172b4d]">
                      {g.name}
                      {g.description && (
                        <span className="block text-[11px] text-[#6b778c]">
                          {g.description}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <SourceBadge source={g.source} />
                    </td>
                    <td className="px-3 py-2 text-[#42526e]">{g.memberCount}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelected(g)}
                          className="px-2 py-1 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#f4f5f7]"
                        >
                          멤버 관리
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(g)}
                          disabled={isKc || remove.isPending}
                          title={
                            isKc
                              ? "Keycloak 동기화 그룹은 삭제할 수 없습니다"
                              : undefined
                          }
                          className="px-2 py-1 text-[12px] rounded border border-[#ffbdad] text-[#bf2600] hover:bg-[#ffebe6] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <GroupMembersPanel
          group={selected}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}

      {showCreate && (
        <CreateGroupDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: "LOCAL" | "KEYCLOAK" }) {
  const isKc = source === "KEYCLOAK";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] ${
        isKc ? "bg-[#deebff] text-[#0747a6]" : "bg-[#e3fcef] text-[#006644]"
      }`}
    >
      {isKc ? "Keycloak" : "로컬"}
    </span>
  );
}

function GroupMembersPanel({
  group,
  onClose,
  onChanged,
}: {
  group: Group;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const isKc = group.source === "KEYCLOAK";
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery<GroupMember[]>({
    queryKey: ["admin-group-members", group.id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/groups/${group.id}/members`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("멤버 조회 실패");
      return (await r.json()) as GroupMember[];
    },
  });

  const refreshMembers = () => {
    queryClient.invalidateQueries({
      queryKey: ["admin-group-members", group.id],
    });
    onChanged(); // 멤버 수 갱신.
  };

  const addMember = useMutation<void, Error, string>({
    mutationFn: async (userId) => {
      const r = await fetch(`/api/admin/groups/${group.id}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "멤버 추가 실패");
      }
    },
    onSuccess: refreshMembers,
    onError: (err) => window.alert(err.message),
  });

  const removeMember = useMutation<void, Error, string>({
    mutationFn: async (userId) => {
      const r = await fetch(
        `/api/admin/groups/${group.id}/members/${userId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "멤버 제거 실패");
      }
    },
    onSuccess: refreshMembers,
    onError: (err) => window.alert(err.message),
  });

  const memberIds = (data ?? []).map((m) => m.id);

  return (
    <div className="bg-white border border-[#dfe1e6] rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-[#172b4d]">
          {group.name} — 멤버
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] text-[#6b778c] hover:text-[#172b4d]"
        >
          닫기
        </button>
      </div>

      {isKc && (
        <p className="text-[12px] text-[#974f0c] bg-[#fffae6] border border-[#ffe380] rounded px-3 py-2">
          Keycloak 에서 동기화된 그룹입니다. 멤버는 Keycloak 에서 관리됩니다.
        </p>
      )}

      {!isKc && (
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="px-3 py-1.5 text-[12px] rounded border border-[#0052cc] text-[#0052cc] hover:bg-[#f4f8ff]"
          >
            + 멤버 추가
          </button>
          {showAdd && (
            <UserSearchCombobox
              excludeIds={memberIds}
              onSelect={(u) => {
                addMember.mutate(u.id);
                setShowAdd(false);
              }}
              onClose={() => setShowAdd(false)}
            />
          )}
        </div>
      )}

      <div className="border border-[#dfe1e6] rounded-md overflow-hidden">
        {isLoading && (
          <div className="p-4 text-[13px] text-[#6b778c]">불러오는 중...</div>
        )}
        {data && data.length === 0 && (
          <div className="p-4 text-[13px] text-[#6b778c]">
            멤버가 없습니다.
          </div>
        )}
        {data && data.length > 0 && (
          <ul className="divide-y divide-[#dfe1e6]">
            {data.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between px-3 py-2 text-[13px]"
              >
                <span className="text-[#172b4d]">
                  {m.name}
                  <span className="text-[11px] text-[#6b778c] ml-2">
                    @{m.username}
                  </span>
                  {m.department && (
                    <span className="text-[11px] text-[#6b778c] ml-2">
                      {m.department}
                    </span>
                  )}
                </span>
                {!isKc && (
                  <button
                    type="button"
                    onClick={() => removeMember.mutate(m.id)}
                    disabled={removeMember.isPending}
                    className="px-2 py-1 text-[12px] rounded border border-[#dfe1e6] text-[#bf2600] hover:bg-[#ffebe6] disabled:opacity-40"
                  >
                    제거
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CreateGroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation<void, Error>({
    mutationFn: async () => {
      const r = await fetch("/api/admin/groups", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() === "" ? undefined : description.trim(),
        }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        if (r.status === 409)
          throw new Error(body.message ?? "이미 같은 이름의 그룹이 있습니다.");
        throw new Error(body.message ?? "그룹 생성 실패");
      }
    },
    onSuccess: onCreated,
    onError: (e) => setErr(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    create.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-md border border-[#dfe1e6] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold text-[#172b4d] mb-4">
          그룹 생성
        </h3>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-[12px] font-semibold text-[#42526e]">
              이름<span className="text-[#de350b] ml-0.5">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              autoComplete="off"
              className="mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-[#42526e]">
              설명 (선택)
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
            />
          </label>
          {err && <p className="text-[12px] text-[#de350b]">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-[13px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#f4f5f7]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="px-3 py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
            >
              {create.isPending ? "생성 중..." : "생성"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
