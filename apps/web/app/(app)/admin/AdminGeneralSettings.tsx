"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Cycle 48 — 관리자 일반 설정. GET/PUT /api/admin/config.
// SMTP 는 Phase 2 — 비활성 카드로 노출만.
// Cycle L1 (feature/ldh) — 전사 ứng dụng 탐색기 항목은 관리자만 관리한다.

type AppConfig = {
  id: string;
  siteName: string;
  uploadLimitMb: number;
  sessionExpireMin: number;
  updatedAt: string;
};

type AppLauncherItemForm = {
  id?: string;
  name: string;
  url: string;
  position: number;
};

type AppLauncherItem = {
  id: string;
  name: string;
  url: string;
  position: number;
};

type AdminGeneralSettingsCard = "general" | "launcher";

export default function AdminGeneralSettings({ activeTab }: { activeTab: "general" | "launcher" | "smtp" }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<AppConfig>({
    queryKey: ["admin-config"],
    queryFn: async () => {
      const r = await fetch("/api/admin/config", { credentials: "include" });
      if (!r.ok) throw new Error("설정 조회 실패");
      return (await r.json()) as AppConfig;
    },
    enabled: activeTab === "general" || activeTab === "smtp",
  });

  const [siteName, setSiteName] = useState("");
  const [uploadLimitMb, setUploadLimitMb] = useState(100);
  const [sessionExpireMin, setSessionExpireMin] = useState(10080);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setSiteName(data.siteName);
      setUploadLimitMb(data.uploadLimitMb);
      setSessionExpireMin(data.sessionExpireMin);
    }
  }, [data]);

  const save = useMutation<AppConfig, Error>({
    mutationFn: async () => {
      const r = await fetch("/api/admin/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName, uploadLimitMb, sessionExpireMin }),
      });
      if (!r.ok) throw new Error("저장 실패");
      return (await r.json()) as AppConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-config"] });
      setSaveMsg("저장됨");
      setTimeout(() => setSaveMsg(null), 2000);
    },
    onError: (err) => window.alert(err.message),
  });

  if ((activeTab === "general" || activeTab === "smtp") && isLoading) return <div className="text-[13px] text-[#6b778c]">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      {activeTab === "general" && (
        <div className="bg-white border border-[#dfe1e6] rounded-md p-5 space-y-4">
        <label className="block">
          <span className="text-[12px] font-semibold text-[#42526e]">사이트 이름</span>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            maxLength={120}
            className="mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#42526e]">
            파일 업로드 크기 제한 <span className="text-[#6b778c] font-normal">(MB)</span>
          </span>
          <input
            type="number"
            min={1}
            max={10240}
            value={uploadLimitMb}
            onChange={(e) => setUploadLimitMb(Number(e.target.value))}
            className="mt-1 w-40 px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#42526e]">
            세션 만료 시간 <span className="text-[#6b778c] font-normal">(분)</span>
          </span>
          <input
            type="number"
            min={1}
            max={525600}
            value={sessionExpireMin}
            onChange={(e) => setSessionExpireMin(Number(e.target.value))}
            className="mt-1 w-40 px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
          <span className="block mt-1 text-[11px] text-[#6b778c]">
            기본 10080 분 = 7일. 적용은 다음 발급되는 docspace_session 토큰부터.
          </span>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-4 py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
          >
            {save.isPending ? "저장 중..." : "저장"}
          </button>
          {saveMsg && <span className="text-[12px] text-[#36b37e]">{saveMsg}</span>}
        </div>
      </div>
      )}

      {activeTab === "launcher" && (
        <div className="bg-white border border-[#dfe1e6] rounded-md p-5 space-y-4">
          <Applications />
        </div>
      )}

      {activeTab === "smtp" && (
        <div className="space-y-4">
          <div className="bg-[#f4f5f7] border border-dashed border-[#c1c7d0] rounded-md p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[14px] font-semibold text-[#172b4d]">SMTP 설정</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#dfe1e6] text-[#42526e] uppercase tracking-wide">
                Phase 2 예정
              </span>
            </div>
            <p className="text-[13px] text-[#6b778c] leading-relaxed">
              이메일 발송(알림, 비밀번호 재설정, 초대 메일 등)에 사용되는 SMTP 서버 설정입니다.
              Phase 2에서 구현 예정이며, 현재는 설정을 변경할 수 없습니다.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

function Applications() {
  const queryClient = useQueryClient();
  const [formItems, setFormItems] = useState<AppLauncherItemForm[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const itemsQuery = useQuery<AppLauncherItem[]>({
    queryKey: ["admin-launchers"],
    queryFn: async () => {
      const r = await fetch("/api/admin/launchers", { credentials: "include" });
      if (!r.ok) throw new Error("바로가기를 불러오지 못했습니다.");
      return (await r.json()) as AppLauncherItem[];
    },
  });

  const saveLauncherMutation = useMutation<void, Error, AppLauncherItemForm[]>({
    mutationFn: async (items) => {
      const r = await fetch("/api/admin/launchers", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`저장 실패 (${r.status}): ${body}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-launchers"] });
      setSaveMsg("저장되었습니다");
      setTimeout(() => setSaveMsg(null), 2500);
    },
    onError: (err) => window.alert(err.message),
  });

  useEffect(() => {
    if (itemsQuery.data) {
      setFormItems(
        itemsQuery.data.map((item, index) => ({
          id: item.id,
          name: item.name,
          url: item.url,
          position: index,
        })),
      );
    }
  }, [itemsQuery.data]);

  const addApplication = () => {
    setFormItems((items) => [
      ...items,
      { name: "", url: "https://", position: items.length },
    ]);
  };

  const saveLaunchers = () => {
    const payload = formItems.map((item, index) => ({
      name: item.name.trim() || `바로가기 ${index + 1}`,
      url: item.url.trim() || "https://example.com",
      position: index,
    }));
    saveLauncherMutation.mutate(payload);
  };

  const removeLauncher = (index: number) => {
    setFormItems((items) => items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: "name" | "url", value: string) => {
    setFormItems((items) =>
      items.map((current, i) =>
        i === index ? { ...current, [field]: value } : current,
      ),
    );
  };

  const onDragStart = (index: number) => {
    setDragIndex(index);
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const onDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      setFormItems((items) => {
        const next = [...items];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(dragOverIndex, 0, moved);
        return next;
      });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  if (itemsQuery.isLoading) return <div className="text-[13px] text-[#6b778c]">불러오는 중...</div>;
  if (itemsQuery.isError) return <div className="text-[13px] text-[#de350b]">바로가기 항목을 불러오지 못했습니다.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#172b4d]">응용 프로그램 탐색기 항목</h2>
          <p className="text-[12px] text-[#6b778c]">
            관리자가 지정한 항목만 로그인한 사용자가 볼 수 있습니다. 드래그하여 순서를 변경할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={addApplication}
          className="px-3 py-1.5 text-[13px] font-semibold rounded bg-[#0052cc] text-white hover:bg-[#0747a6]"
        >
          + 추가
        </button>
      </div>

      {saveMsg && (
        <div className="rounded-md border border-[#c1ecff] bg-[#eaf7ff] px-3 py-2 text-[12px] text-[#0052cc]">
          {saveMsg}
        </div>
      )}

      {formItems.length === 0 ? (
        <div className="rounded-md border border-[#dfe1e6] bg-[#f4f5f7] px-4 py-6 text-center text-[13px] text-[#6b778c]">
          등록된 바로가기 항목이 없습니다.<br />
          <button
            type="button"
            onClick={addApplication}
            className="mt-2 text-[#0052cc] font-semibold hover:underline"
          >
            + 항목 추가하기
          </button>
        </div>
      ) : (
        <div className="border border-[#dfe1e6] rounded-md divide-y divide-[#dfe1e6]">
          {formItems.map((item, index) => (
            <div
              key={item.id ?? `new-${index}`}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-3 px-3 py-2.5 ${
                dragOverIndex === index && dragIndex !== index
                  ? "border-t-2 border-t-[#0052cc]"
                  : ""
              } ${dragIndex === index ? "opacity-40" : ""} hover:bg-[#f8f9fa]`}
            >
              {/* Drag handle */}
              <div
                className="shrink-0 cursor-grab active:cursor-grabbing text-[#a5adba] hover:text-[#42526e] px-0.5"
                title="드래그하여 순서 변경"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <circle cx="4" cy="3" r="1.2" />
                  <circle cx="10" cy="3" r="1.2" />
                  <circle cx="4" cy="7" r="1.2" />
                  <circle cx="10" cy="7" r="1.2" />
                  <circle cx="4" cy="11" r="1.2" />
                  <circle cx="10" cy="11" r="1.2" />
                </svg>
              </div>

              {/* Name */}
              <input
                type="text"
                placeholder="이름"
                value={item.name}
                onChange={(e) => updateItem(index, "name", e.target.value)}
                className="w-36 shrink-0 px-2 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
                maxLength={120}
              />

              {/* URL */}
              <input
                type="text"
                placeholder="URL"
                value={item.url}
                onChange={(e) => updateItem(index, "url", e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
                maxLength={500}
              />

              {/* Delete */}
              <button
                type="button"
                onClick={() => removeLauncher(index)}
                className="shrink-0 px-2 py-1 text-[12px] text-[#6b778c] hover:text-[#de350b] rounded hover:bg-[#ffebe6]"
                title="삭제"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {formItems.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveLaunchers}
            disabled={saveLauncherMutation.isPending}
            className="px-4 py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
          >
            {saveLauncherMutation.isPending ? "저장 중..." : "저장"}
          </button>
          <span className="text-[12px] text-[#6b778c]">순서 변경 후 저장 버튼을 눌러주세요.</span>
        </div>
      )}
    </div>
  );
}