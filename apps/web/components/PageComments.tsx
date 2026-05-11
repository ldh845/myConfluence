"use client";

import {
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getIdentity } from "@/lib/userIdentity";

// FR-070 (Cycle 16-1b) — 페이지 댓글 기본 UI.
// 답글(스레드)·리치 텍스트는 16-2, 권한·인증은 별도 사이클.

type Comment = {
  id: string;
  pageId: string;
  parentId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  pageId: string;
  editable: boolean;
};

export default function PageComments({ pageId, editable }: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  const { data, isLoading } = useQuery<Comment[]>({
    queryKey: ["comments", pageId],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${pageId}/comments`);
      if (!r.ok) return [];
      return (await r.json()) as Comment[];
    },
    enabled: !!pageId,
  });

  const create = useMutation({
    mutationFn: async (body: string) => {
      const r = await fetch(`/api/pages/${pageId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ body, authorName: getIdentity().name }),
      });
      if (!r.ok) {
        if (r.status === 400) throw new Error("내용을 입력하세요.");
        throw new Error("댓글 작성에 실패했습니다.");
      }
      return (await r.json()) as Comment;
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["comments", pageId] });
    },
    onError: (err: Error) => window.alert(err.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const r = await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ body }),
      });
      if (!r.ok) throw new Error("댓글 수정에 실패했습니다.");
      return r.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingBody("");
      queryClient.invalidateQueries({ queryKey: ["comments", pageId] });
    },
    onError: (err: Error) => window.alert(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm("이 댓글을 삭제하시겠습니까?")) {
        throw new Error("cancel");
      }
      const r = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("댓글 삭제에 실패했습니다.");
      return r.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["comments", pageId] }),
    onError: (err: Error) => {
      if (err.message === "cancel") return;
      window.alert(err.message);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || create.isPending) return;
    create.mutate(body);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const body = draft.trim();
      if (!body || create.isPending) return;
      create.mutate(body);
    }
  };

  const startEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditingBody(c.body);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingBody("");
  };
  const saveEdit = () => {
    if (!editingId) return;
    const body = editingBody.trim();
    if (!body) return;
    update.mutate({ id: editingId, body });
  };

  const comments = data ?? [];

  return (
    <section className="mt-8 border-t border-[#dfe1e6] pt-6">
      <h3 className="text-[15px] font-semibold text-[#172b4d] mb-3">
        💬 댓글 ({comments.length}개)
      </h3>

      {editable && (
        <form onSubmit={submit} className="mb-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder="댓글 작성... (Ctrl+Enter로 빠른 작성)"
            className="w-full min-h-[80px] border border-[#dfe1e6] rounded-md p-2 text-[13px] focus:outline-none focus:border-[#0052cc]"
            disabled={create.isPending}
          />
          <div className="text-right mt-2">
            <button
              type="submit"
              disabled={!draft.trim() || create.isPending}
              className="px-4 py-1.5 bg-[#0052cc] text-white text-[13px] rounded hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
            >
              {create.isPending ? "작성 중..." : "댓글 작성"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
      ) : comments.length === 0 ? (
        <div className="text-[12px] text-[#6b778c]">아직 댓글이 없습니다.</div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const isEditing = editingId === c.id;
            return (
              <li
                key={c.id}
                className="border border-[#dfe1e6] rounded-md p-3 bg-[#f9fafb]"
              >
                <div className="flex items-center justify-between mb-1 text-[11px] text-[#6b778c]">
                  <span>
                    <strong className="text-[#172b4d]">
                      {c.authorName ?? "익명"}
                    </strong>
                    <span> · {new Date(c.createdAt).toLocaleString("ko-KR")}</span>
                    {c.updatedAt !== c.createdAt && <span> (수정됨)</span>}
                  </span>
                  {editable && !isEditing && (
                    <span>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="hover:underline mr-2"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => remove.mutate(c.id)}
                        className="hover:underline text-[#de350b]"
                      >
                        삭제
                      </button>
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <>
                    <textarea
                      value={editingBody}
                      onChange={(e) => setEditingBody(e.target.value)}
                      className="w-full min-h-[60px] border border-[#dfe1e6] rounded p-2 text-[13px] focus:outline-none focus:border-[#0052cc]"
                    />
                    <div className="text-right mt-1">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-[12px] mr-2 hover:underline"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={!editingBody.trim() || update.isPending}
                        className="px-3 py-1 bg-[#0052cc] text-white text-[12px] rounded hover:bg-[#0747a6] disabled:bg-[#a5adba]"
                      >
                        {update.isPending ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-[13px] text-[#172b4d] whitespace-pre-wrap">
                    {c.body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
