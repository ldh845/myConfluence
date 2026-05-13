"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/useAuth";

// FR-073 (Cycle 25) — 페이지/댓글 이모지 반응.
// FR-001 (Cycle 27e) — JWT user 기반. 익명 reactorId 폐지.

const EMOJI_SET = ["👍", "❤️", "🎉", "🚀", "😀", "😢", "👀", "🔥"];

type ReactionGroup = {
  emoji: string;
  count: number;
  userIds: string[];
  userNames: string[];
};

type Props = {
  target: "page" | "comment";
  targetId: string;
};

export default function ReactionBar({ target, targetId }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);

  const queryKey = ["reactions", target, targetId];
  const endpoint =
    target === "page"
      ? `/api/pages/${targetId}/reactions`
      : `/api/comments/${targetId}/reactions`;

  const { data } = useQuery<ReactionGroup[]>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(endpoint);
      if (!r.ok) return [];
      return (await r.json()) as ReactionGroup[];
    },
    enabled: !!targetId,
  });

  const toggle = useMutation<{ reacted: boolean }, Error, string>({
    mutationFn: async (emoji) => {
      const body: Record<string, unknown> = { emoji };
      if (target === "page") body.pageId = targetId;
      else body.commentId = targetId;
      const r = await fetch(`/api/reactions/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        throw new Error("반응을 저장하지 못했습니다.");
      }
      return (await r.json()) as { reacted: boolean };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => window.alert(err.message),
  });

  const groups = data ?? [];

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {groups.map((g) => {
        const mine = !!user && g.userIds.includes(user.id);
        return (
          <button
            key={g.emoji}
            type="button"
            onClick={() => toggle.mutate(g.emoji)}
            disabled={toggle.isPending}
            title={
              g.userNames.filter(Boolean).join(", ") || `반응 ${g.count}개`
            }
            className={
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border transition-colors " +
              (mine
                ? "bg-[#deebff] border-[#0052cc] text-[#0052cc]"
                : "bg-white border-[#dfe1e6] text-[#42526e] hover:bg-[#f4f5f7]")
            }
          >
            <span className="text-[14px] leading-none">{g.emoji}</span>
            <span className="font-semibold">{g.count}</span>
          </button>
        );
      })}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-[#a5adba] text-[#6b778c] hover:bg-[#f4f5f7] text-[11px]"
          title="이모지 반응 추가"
        >
          ＋
        </button>
        {pickerOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setPickerOpen(false)}
            />
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#dfe1e6] rounded shadow-lg p-1.5 flex gap-1">
              {EMOJI_SET.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    toggle.mutate(e);
                  }}
                  className="text-[18px] w-7 h-7 rounded hover:bg-[#f4f5f7]"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
