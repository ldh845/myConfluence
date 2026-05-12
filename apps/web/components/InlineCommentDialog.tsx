"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getIdentity } from "@/lib/userIdentity";
import { usePageStore } from "@/lib/stores/usePageStore";

// FR-071 (Cycle 16-3b-1) — 인라인 댓글 작성 popup.
// 호출 측(EditorToolbar)에서 from/to + selected text 전달, 작성 성공 시 onCreated로
// 새 Comment id를 반환해 부모가 본문에 마크를 입힌다.

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedText: string;
  anchorFrom: number;
  anchorTo: number;
  onCreated: (commentId: string) => void;
};

export default function InlineCommentDialog({
  open,
  onOpenChange,
  selectedText,
  anchorFrom,
  anchorTo,
  onCreated,
}: Props) {
  const queryClient = useQueryClient();
  const pageId = usePageStore((s) => s.pageId);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) setBody("");
  }, [open]);

  const create = useMutation({
    mutationFn: async () => {
      if (!pageId) throw new Error("페이지가 로드되지 않았습니다.");
      const trimmed = body.trim();
      if (!trimmed) throw new Error("내용을 입력하세요.");
      const anchorJson = JSON.stringify({
        from: anchorFrom,
        to: anchorTo,
        text: selectedText,
      });
      const r = await fetch(`/api/pages/${pageId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          body: trimmed,
          authorName: getIdentity().name,
          isInline: true,
          anchorJson,
        }),
      });
      if (!r.ok) {
        if (r.status === 400) throw new Error("내용을 입력하세요.");
        throw new Error("댓글 작성에 실패했습니다.");
      }
      return (await r.json()) as { id: string };
    },
    onSuccess: (data) => {
      onCreated(data.id);
      queryClient.invalidateQueries({ queryKey: ["comments", pageId] });
      onOpenChange(false);
    },
    onError: (err: Error) => window.alert(err.message),
  });

  const preview =
    selectedText.length > 80
      ? selectedText.slice(0, 80) + "..."
      : selectedText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>인라인 댓글</DialogTitle>
        </DialogHeader>
        <div className="px-3 py-2 border-l-4 border-[#fbc02d] bg-[#fffbe6] text-[13px] text-[#172b4d] whitespace-pre-wrap">
          “{preview}”
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="댓글 내용..."
          autoFocus
          className="w-full min-h-[80px] border border-[#dfe1e6] rounded p-2 text-[13px] focus:outline-none focus:border-[#0052cc]"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#ebecf0]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={!body.trim() || create.isPending}
            className="px-3 py-1 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
          >
            {create.isPending ? "작성 중..." : "작성"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
