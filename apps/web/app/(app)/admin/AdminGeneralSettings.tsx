"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Cycle 48 — 관리자 일반 설정. GET/PUT /api/admin/config.
// SMTP 는 Phase 2 — 비활성 카드로 노출만.

type AppConfig = {
  id: string;
  siteName: string;
  uploadLimitMb: number;
  sessionExpireMin: number;
  updatedAt: string;
};

export default function AdminGeneralSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<AppConfig>({
    queryKey: ["admin-config"],
    queryFn: async () => {
      const r = await fetch("/api/admin/config", { credentials: "include" });
      if (!r.ok) throw new Error("설정 조회 실패");
      return (await r.json()) as AppConfig;
    },
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

  if (isLoading) return <div className="text-[13px] text-[#6b778c]">불러오는 중...</div>;

  return (
    <div className="space-y-6">
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

      <div className="bg-[#f4f5f7] border border-dashed border-[#c1c7d0] rounded-md p-5 opacity-70">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-semibold text-[#172b4d]">SMTP 설정</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#dfe1e6] text-[#42526e] uppercase">
            Phase 2 예정
          </span>
        </div>
        <p className="text-[12px] text-[#6b778c]">
          이메일 발송(알림·비밀번호 재설정 등)에 사용. Phase 2에서 구현 예정.
        </p>
      </div>
    </div>
  );
}
