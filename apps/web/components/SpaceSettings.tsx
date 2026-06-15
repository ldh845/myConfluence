"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { canManageSpace } from "@/lib/spacePermission";
import SpaceAvatar from "@/components/SpaceAvatar";
import SpaceMembersPanel from "@/components/SpaceMembersPanel";
import SpaceMemberGroupsPanel from "@/components/SpaceMemberGroupsPanel";
import SpaceAuditPanel from "@/components/SpaceAuditPanel";
import SpacePageOrderPanel from "@/components/SpacePageOrderPanel";
import SpaceSidebarConfigPanel from "@/components/SpaceSidebarConfigPanel";
import type { SpaceWithPages, SpaceVisibility } from "@/lib/types";

// Cycle 74-B~F — 공간 도구. 개요/권한/감사 로그/페이지 순서/사이드바 구성 탭.
const TABS: { id: string; label: string; enabled: boolean }[] = [
  { id: "overview", label: "개요", enabled: true },
  { id: "permissions", label: "권한", enabled: true },
  { id: "audit", label: "감사 로그", enabled: true },
  { id: "order", label: "페이지 순서", enabled: true },
  { id: "sidebar", label: "사이드바 구성", enabled: true },
];

// Cycle 74-G — 이모지 프리셋.
const ICON_PRESETS = ["📄", "📁", "📚", "💡", "🚀", "⭐", "🔧", "🎯", "🧭", "🗂️"];

// 이미지를 128px 이내로 리사이즈한 data URL 로 변환(DB·전송 부담 최소화).
function fileToIconDataUrl(file: File, max = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("canvas unsupported"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

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
  const searchParams = useSearchParams();
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

  // Cycle 74 — 사이드바 드롭다운이 ?tab= 로 진입 탭을 지정. 유효하지 않으면 개요.
  const tabParam = searchParams.get("tab");
  const ENABLED_TABS = [
    "overview",
    "permissions",
    "audit",
    "order",
    "sidebar",
  ];
  const [activeTab, setActiveTab] = useState(
    tabParam && ENABLED_TABS.includes(tabParam) ? tabParam : "overview",
  );
  useEffect(() => {
    if (tabParam && ENABLED_TABS.includes(tabParam)) setActiveTab(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<SpaceVisibility>("PUBLIC");
  const [icon, setIcon] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  // Cycle 75 — 개요 탭: 기본은 보기 모드, '세부 정보 편집' 시에만 입력 활성.
  const [editingDetails, setEditingDetails] = useState(false);
  // Cycle 75 — 삭제는 별도 버튼으로 분리. 클릭 시 확인 박스 노출.
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (space) {
      setName(space.name);
      setDescription(space.description ?? "");
      setVisibility((space.visibility as SpaceVisibility) ?? "PUBLIC");
      setIcon(space.icon ?? null);
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
          icon,
          ...(space?.type !== "PERSONAL" ? { visibility } : {}),
        }),
      });
      if (!r.ok) throw new Error("save failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      setEditingDetails(false);
      window.alert("저장되었습니다.");
    },
    onError: () => window.alert("저장에 실패했습니다."),
  });

  // 편집 취소 시 입력값을 서버 상태로 되돌린다.
  const resetDetails = () => {
    if (!space) return;
    setName(space.name);
    setDescription(space.description ?? "");
    setVisibility((space.visibility as SpaceVisibility) ?? "PUBLIC");
    setIcon(space.icon ?? null);
  };

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

  // Cycle 75 followup — 개인 공간도 모든 탭(권한 포함) 노출(사용자 요청).
  //   단 개인 공간 멤버 추가는 권한 모델상 실제 접근을 부여하지 않음(표시용).
  const visibleTabs = TABS;

  return (
    <div className="px-6 pt-6 pb-16 max-w-[760px]">
      <h1 className="text-[22px] font-semibold text-[#172b4d] mb-1">
        {space.name} · 공간 도구
      </h1>
      <p className="text-[12px] text-[#6b778c] mb-4">
        스페이스 설정과 권한을 관리합니다.
      </p>

      <div className="flex gap-1 border-b border-[#dfe1e6] mb-5">
        {visibleTabs.map((t) => (
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

      {activeTab === "permissions" && (
        <div className="space-y-8">
          <section>
            <h3 className="text-[13px] font-semibold text-[#172b4d] mb-3">
              멤버 (개인)
            </h3>
            <SpaceMembersPanel spaceId={spaceId} />
          </section>
          {/* Cycle L7 — 그룹 권한. 개인 멤버십과 max 결합. */}
          <section>
            <h3 className="text-[13px] font-semibold text-[#172b4d] mb-3">
              그룹
            </h3>
            <SpaceMemberGroupsPanel spaceId={spaceId} />
          </section>
        </div>
      )}
      {activeTab === "audit" && <SpaceAuditPanel spaceId={spaceId} />}
      {activeTab === "order" && <SpacePageOrderPanel spaceId={spaceId} />}
      {activeTab === "sidebar" && (
        <SpaceSidebarConfigPanel spaceId={spaceId} />
      )}

      <div
        className="space-y-5"
        style={{ display: activeTab === "overview" ? undefined : "none" }}
      >
        {!editingDetails ? (
          /* ── 보기 모드 ── 세부 정보를 읽기 전용으로 표시 + 편집 진입 버튼. */
          <>
            <div className="flex items-start gap-4">
              <SpaceAvatar name={space.name} icon={icon} size={48} />
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <div className="text-[12px] font-semibold text-[#42526e]">
                    이름
                  </div>
                  <div className="text-[14px] text-[#172b4d]">{space.name}</div>
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-[#42526e]">
                    설명
                  </div>
                  <div className="text-[14px] text-[#172b4d] whitespace-pre-wrap">
                    {space.description?.trim() ? space.description : "—"}
                  </div>
                </div>
                {space.type !== "PERSONAL" && (
                  <div>
                    <div className="text-[12px] font-semibold text-[#42526e]">
                      공개 범위
                    </div>
                    <div className="text-[14px] text-[#172b4d]">
                      {visibility === "PUBLIC"
                        ? "전체 공개 — 모든 로그인 사용자 접근"
                        : "비공개 — 멤버만 접근"}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setEditingDetails(true)}
                className="px-4 py-2 rounded border border-[#dfe1e6] hover:bg-[#f4f5f7] text-[13px] font-medium text-[#172b4d]"
              >
                스페이스 세부 정보 편집
              </button>
            </div>
          </>
        ) : (
          /* ── 편집 모드 ── 아이콘/이름/설명/공개범위 입력 + 저장/취소. */
          <>
            <Field label="아이콘">
              <div className="flex items-center gap-3">
                <SpaceAvatar name={space.name} icon={icon} size={48} />
                <div className="flex flex-wrap items-center gap-1">
                  {ICON_PRESETS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setIcon(e)}
                      className="w-8 h-8 rounded border border-[#dfe1e6] hover:bg-[#deebff] text-[18px]"
                    >
                      {e}
                    </button>
                  ))}
                  <label className="px-2 py-1 text-[12px] rounded border border-[#dfe1e6] hover:bg-[#f4f5f7] cursor-pointer">
                    이미지 업로드
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        try {
                          setIcon(await fileToIconDataUrl(f));
                        } catch {
                          window.alert("이미지를 불러올 수 없습니다.");
                        }
                      }}
                    />
                  </label>
                  {icon && (
                    <button
                      type="button"
                      onClick={() => setIcon(null)}
                      className="px-2 py-1 text-[12px] text-[#6b778c] hover:underline"
                    >
                      제거
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-[#6b778c] mt-1">
                이모지를 고르거나 이미지를 올리세요. 이미지는 128px 로 축소돼
                저장됩니다. (&lsquo;저장&rsquo; 을 눌러야 반영)
              </p>
            </Field>
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
                  <option value="PUBLIC">
                    전체 공개 — 모든 로그인 사용자 접근
                  </option>
                  <option value="PRIVATE">비공개 — 멤버만 접근</option>
                </select>
                <p className="text-[11px] text-[#6b778c] mt-1">
                  비공개로 바꾸면 멤버가 아닌 사용자에게는 이 공간의 페이지가
                  보이지 않습니다. (멤버 관리는 &lsquo;권한&rsquo; 탭)
                </p>
              </Field>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !name.trim()}
                className="px-4 py-2 rounded bg-[#0052cc] hover:bg-[#0747a6] disabled:bg-[#a5adba] text-white text-[13px] font-medium"
              >
                {saveMutation.isPending ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDetails();
                  setEditingDetails(false);
                }}
                disabled={saveMutation.isPending}
                className="px-4 py-2 rounded border border-[#dfe1e6] hover:bg-[#f4f5f7] text-[13px] font-medium text-[#42526e]"
              >
                취소
              </button>
            </div>
          </>
        )}

        {/* Cycle 75 followup — 개인 공간도 삭제 버튼 노출(사용자 요청). */}
        <div className="mt-8 border-t border-[#dfe1e6] pt-6">
            {!showDelete ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="px-3 py-1.5 rounded border border-[#ffbdad] text-[#bf2600] hover:bg-[#ffebe6] text-[13px] font-medium"
              >
                스페이스 삭제
              </button>
            ) : (
              <div className="border border-[#ffbdad] rounded-md p-4">
                <h3 className="text-[14px] font-semibold text-[#bf2600] mb-1">
                  스페이스 삭제
                </h3>
                <p className="text-[12px] text-[#6b778c] mb-3">
                  이 공간과 모든 페이지가 영구 삭제됩니다. 되돌릴 수 없습니다.
                  {space.type === "PERSONAL" && (
                    <>
                      {" "}
                      개인 공간은 다음 로그인 시 빈 상태로 자동 재생성되지만,
                      현재 페이지는 복구되지 않습니다.
                    </>
                  )}{" "}
                  확인을 위해 공간 이름{" "}
                  <strong className="text-[#172b4d]">{space.name}</strong>{" "}
                  을(를) 입력하세요.
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
                    disabled={
                      confirmName !== space.name || deleteMutation.isPending
                    }
                    className="px-3 py-1.5 rounded bg-[#de350b] hover:bg-[#bf2600] disabled:bg-[#f4b6a6] text-white text-[13px] font-medium shrink-0"
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDelete(false);
                      setConfirmName("");
                    }}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1.5 rounded border border-[#dfe1e6] hover:bg-[#f4f5f7] text-[13px] font-medium text-[#42526e] shrink-0"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
