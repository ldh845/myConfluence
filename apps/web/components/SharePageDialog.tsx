"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// FR-120 (Cycle 23) — 페이지 공유 다이얼로그.
// POST /api/pages/:id/share (idempotent) — 활성 토큰 가져오기/발급.
// FR-001 (Cycle 27d) — createdBy 표시. mutation은 credentials: include.

type ShareCreator = {
  id: string;
  username: string;
  name: string;
  department: string;
  role: string;
};

type Share = {
  id: string;
  pageId: string;
  token: string;
  createdAt: string;
  revokedAt: string | null;
  createdBy?: ShareCreator | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  page: { id: string; title: string };
};

export default function SharePageDialog({ open, onOpenChange, page }: Props) {
  const queryClient = useQueryClient();
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    if (open) setRevoked(false);
  }, [open]);

  // 다이얼로그가 열릴 때만 idempotent POST 호출 — 활성 토큰 있으면 그대로 반환.
  const { data: share } = useQuery<Share>({
    queryKey: ["page-share", page.id],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${page.id}/share`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        throw new Error("공유 링크를 가져오지 못했습니다.");
      }
      return (await r.json()) as Share;
    },
    enabled: open && !revoked,
  });

  const rotate = useMutation<Share, Error>({
    mutationFn: async () => {
      const r = await fetch(`/api/pages/${page.id}/share/rotate`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        throw new Error("새 링크 발급에 실패했습니다.");
      }
      return (await r.json()) as Share;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["page-share", page.id], data);
    },
    onError: (err) => window.alert(err.message),
  });

  const revoke = useMutation<void, Error>({
    mutationFn: async () => {
      const r = await fetch(`/api/pages/${page.id}/share`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        throw new Error("공유 중지에 실패했습니다.");
      }
    },
    onSuccess: () => {
      setRevoked(true);
      queryClient.removeQueries({ queryKey: ["page-share", page.id] });
    },
    onError: (err) => window.alert(err.message),
  });

  const shareUrl =
    share && !revoked
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${share.token}`
      : "";

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      window.alert("공유 링크가 클립보드에 복사되었습니다.");
    } catch {
      window.alert("복사에 실패했습니다. 직접 선택해서 복사하세요.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>페이지 공유</DialogTitle>
        </DialogHeader>

        <div className="text-[12px] text-[#6b778c]">
          페이지: <strong className="text-[#172b4d]">{page.title}</strong>
        </div>

        {revoked ? (
          <>
            <div className="text-[13px] text-[#6b778c] py-2">
              이 페이지의 공유가 중지되었습니다. 다시 공유하려면 아래 버튼을
              누르세요.
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRevoked(false);
                  queryClient.invalidateQueries({
                    queryKey: ["page-share", page.id],
                  });
                }}
                className="px-3 py-1 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6]"
              >
                다시 공유
              </button>
            </div>
          </>
        ) : (
          <>
            <section className="space-y-2">
              <label className="block text-[12px] font-semibold text-[#42526e]">
                공유 링크
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-2 py-1.5 text-[12px] border border-[#dfe1e6] rounded bg-[#f4f5f7] font-mono"
                />
                <button
                  type="button"
                  onClick={copy}
                  disabled={!shareUrl}
                  className="px-3 py-1 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
                >
                  📋 복사
                </button>
              </div>
              <p className="text-[11px] text-[#6b778c]">
                이 링크를 가진 사람은 누구나 페이지를 읽기 전용으로 볼 수
                있습니다. 편집은 불가합니다.
              </p>
              {share && (
                <p className="text-[11px] text-[#6b778c]">
                  이 링크는{" "}
                  <strong className="text-[#172b4d]">
                    {share.createdBy?.name ?? "레거시 (시스템)"}
                  </strong>
                  이(가){" "}
                  {new Date(share.createdAt).toLocaleString("ko-KR")}에 발급했습니다.
                </p>
              )}
            </section>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => revoke.mutate()}
                disabled={revoke.isPending || !share}
                className="text-[12px] text-[#de350b] hover:underline disabled:opacity-50"
              >
                🚫 공유 중지
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => rotate.mutate()}
                  disabled={rotate.isPending || !share}
                  className="px-3 py-1 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#ebecf0] disabled:opacity-50"
                >
                  🔄 새 링크 발급
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="px-3 py-1 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#ebecf0]"
                >
                  닫기
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
