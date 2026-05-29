"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { canManageSpace } from "@/lib/spacePermission";
import SpaceMembersPanel from "@/components/SpaceMembersPanel";
import type { SpaceWithPages, SpaceVisibility } from "@/lib/types";

// Cycle 74-B/C — 공간 도구. 개요(74-B) + 권한(74-C) 탭.
//   나머지 탭(감사로그/페이지순서/사이드바구성)은 74-D~F 에서 채운다.
const TABS: { id: string; label: string; enabled: boolean }[] = [
  { id: "overview", label: "개요", enabled: true },
  { id: "permissions", label: "권한", enabled: true },
  { id: "audit", label: "감사 로그", enabled: false },
  { id: "order", label: "페이지 순서", enabled: false },
  { id: "sidebar", label: "사이드바 구성", enabled: false },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[#42526e] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function SpaceSettings({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces", { credentials: "include" });
      return r.ok ? ((await r.json()) as SpaceWithPages[]) : [];
    },
  });
  const space = useMemo(
    () => (spaces ?? []).find((s) => s.id === spaceId) ?? null,
    [spaces, spaceId],
  );

  const [activeTab, setActiveTab] = useState("overview");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<SpaceVisibility>("PUBLIC");
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    if (space) {
      setName(space.name);
      setDescription(space.description ?? "");
      setVisibility((space.visibility as SpaceVisibility) ?? "PUBLIC");
    }
  }, [space]);

  const canManage = canManageSpace(space, user);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/spaces/${spaceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description,
          ...(space?.type !== "PERSONAL" ? { visibility } : {}),
        }),
      });
      if (!r.ok) throw new Error("save failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      window.alert("저장되었습니다.");
    },
    onError: () => window.alert("저장에 실패했습니다."),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/spaces/${spaceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("delete failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      router.push("/home");
    },
    onError: () => window.alert("삭제에 실패했습니다."),
  });

  if (!space) {
    return (
      <div className="px-6 pt-6 text-[13px] text-[#6b778c]">불러오는 중...</div>
    );
  }
  if (!canManage) {
    return (
      <div className="px-6 pt-6 text-[13px] text-[#6b778c]">
        이 공간을 관리할 권한이 없습니다.
      </div>
    );
  }

  return (
    <div className="px-6 pt-6 pb-16 max-w-[760px]">
      <h1 className="text-[22px] font-semibold text-[#172b4d] mb-1">
        {space.name} · 공간 도구
      </h1>
      <p className="text-[12px] text-[#6b778c] mb-4">
        스페이스 설정과 권한을 관리합니다.
      </p>

      <div className="flex gap-1 border-b border-[#dfe1e6] mb-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={!t.enabled}
            onClick={() => t.enabled && setActiveTab(t.id)}
            title={t.enabled ? undefined : "준비 중"}
            className={`px-3 py-2 text-[13px] border-b-2 -mb-px ${
              activeTab === t.id
                ? "border-[#0052cc] text-[#0052cc] font-semibold"
                : t.enabled
                  ? "border-transparent text-[#42526e] hover:text-[#0052cc]"
                  : "border-transparent text-[#a5adba] cursor-not-allowed"
            }`}
          >
            {t.label}
            {!t.enabled && " (준비 중)"}
          </button>
        ))}
      </div>

      {activeTab === "permissions" && <SpaceMembersPanel spaceId={spaceId} />}

      <div
        className="space-y-5"
        style={{ display: activeTab === "overview" ? undefined : "none" }}
      >
        <Field label="스페이스 이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1.5 text-[14px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
        </Field>
        <Field label="설명">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 text-[14px] border border-[#dfe1e6] rounded resize-y focus:outline-none focus:border-[#0052cc]"
          />
        </Field>
        {space.type !== "PERSONAL" && (
          <Field label="공개 범위">
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as SpaceVisibility)
              }
              className="px-2 py-1.5 text-[14px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
            >
              <option value="PUBLIC">전체 공개 — 모든 로그인 사용자 접근</option>
              <option value="PRIVATE">비공개 — 멤버만 접근</option>
            </select>
            <p className="text-[11px] text-[#6b778c] mt-1">
              비공개로 바꾸면 멤버가 아닌 사용자에게는 이 공간의 페이지가 보이지
              않습니다. (멤버 관리는 &lsquo;권한&rsquo; 탭 — 준비 중)
            </p>
          </Field>
        )}
        <div>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim()}
            className="px-4 py-2 rounded bg-[#0052cc] hover:bg-[#0747a6] disabled:bg-[#a5adba] text-white text-[13px] font-medium"
          >
            {saveMutation.isPending ? "저장 중..." : "저장"}
          </button>
        </div>

        <div className="mt-8 border border-[#ffbdad] rounded-md p-4">
          <h3 className="text-[14px] font-semibold text-[#bf2600] mb-1">
            스페이스 삭제
          </h3>
          <p className="text-[12px] text-[#6b778c] mb-3">
            이 공간과 모든 페이지가 영구 삭제됩니다. 되돌릴 수 없습니다. 확인을
            위해 공간 이름{" "}
            <strong className="text-[#172b4d]">{space.name}</strong> 을(를)
            입력하세요.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={space.name}
              className="flex-1 px-2 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#de350b]"
            />
            <button
              type="button"
              onClick={() => {
                if (
                  confirmName === space.name &&
                  window.confirm("정말 삭제하시겠습니까?")
                ) {
                  deleteMutation.mutate();
                }
              }}
              disabled={confirmName !== space.name || deleteMutation.isPending}
              className="px-3 py-1.5 rounded bg-[#de350b] hover:bg-[#bf2600] disabled:bg-[#f4b6a6] text-white text-[13px] font-medium shrink-0"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
