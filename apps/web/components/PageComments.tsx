"use client";

import {
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactionBar from "@/components/ReactionBar";

// FR-070 (Cycle 16-1b + 16-2a) — 페이지 댓글.
// 16-2a: parentId 기반 트리 빌드 + 들여쓰기 렌더 + 답글 작성.
// FR-001 (Cycle 27d) — author는 JWT user. authorName은 legacy fallback.

type CommentAuthor = {
  id: string;
  username: string;
  name: string;
  department: string;
  role: string;
};

type Comment = {
  id: string;
  pageId: string;
  parentId: string | null;
  authorName: string | null;
  author?: CommentAuthor | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

function displayAuthor(c: Comment): string {
  return c.author?.name ?? c.authorName ?? "익명";
}

type CommentNode = Comment & { children: CommentNode[] };

// flat 배열을 parentId 기반 트리로. 부모가 사라진 고아는 root로 끌어올림.
function buildCommentTree(flat: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: CommentNode[] = [];
  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

type Props = {
  pageId: string;
  editable: boolean;
};

export default function PageComments({ pageId, editable }: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const { data, isLoading } = useQuery<Comment[]>({
    queryKey: ["comments", pageId],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${pageId}/comments`);
      if (!r.ok) return [];
      return (await r.json()) as Comment[];
    },
    enabled: !!pageId,
  });

  const comments = data ?? [];
  const tree = useMemo(() => buildCommentTree(comments), [comments]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["comments", pageId] });

  const create = useMutation({
    mutationFn: async (body: string) => {
      const r = await fetch(`/api/pages/${pageId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        if (r.status === 400) throw new Error("내용을 입력하세요.");
        throw new Error("댓글 작성에 실패했습니다.");
      }
      return (await r.json()) as Comment;
    },
    onSuccess: () => {
      setDraft("");
      invalidate();
    },
    onError: (err: Error) => window.alert(err.message),
  });

  // FR-070 (Cycle 16-2a) — 답글. parentId 포함 POST.
  const reply = useMutation({
    mutationFn: async ({ parentId, body }: { parentId: string; body: string }) => {
      const r = await fetch(`/api/pages/${pageId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify({ body, parentId }),
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        throw new Error("답글 작성에 실패했습니다.");
      }
      return (await r.json()) as Comment;
    },
    onSuccess: () => {
      setReplyingTo(null);
      setReplyBody("");
      invalidate();
    },
    onError: (err: Error) => window.alert(err.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const r = await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        throw new Error("댓글 수정에 실패했습니다.");
      }
      return r.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingBody("");
      invalidate();
    },
    onError: (err: Error) => window.alert(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm("이 댓글을 삭제하시겠습니까? (답글도 함께 삭제됩니다)")) {
        throw new Error("cancel");
      }
      const r = await fetch(`/api/comments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        throw new Error("댓글 삭제에 실패했습니다.");
      }
      return r.json();
    },
    onSuccess: invalidate,
    onError: (err: Error) => {
      if (err.message === "cancel") return;
      window.alert(err.message);
    },
  });

  const submitRoot = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || create.isPending) return;
    create.mutate(body);
  };

  const handleRootKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    setReplyingTo(null);
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

  const startReply = (id: string) => {
    setReplyingTo(id);
    setReplyBody("");
    setEditingId(null);
  };
  const cancelReply = () => {
    setReplyingTo(null);
    setReplyBody("");
  };
  const submitReply = (parentId: string) => {
    const body = replyBody.trim();
    if (!body || reply.isPending) return;
    reply.mutate({ parentId, body });
  };

  // 재귀 렌더. closure로 상태/핸들러 접근. 깊이별 들여쓰기는 max 5.
  const renderItem = (node: CommentNode, depth: number): JSX.Element => {
    const isEditing = editingId === node.id;
    const isReplying = replyingTo === node.id;
    const indent = Math.min(depth, 5) * 24;
    return (
      <li
        key={node.id}
        className="border border-[#dfe1e6] rounded-md p-3 bg-[#f9fafb]"
        style={{ marginLeft: indent }}
      >
        <div className="flex items-center justify-between mb-1 text-[11px] text-[#6b778c]">
          <span>
            <strong className="text-[#172b4d]">{displayAuthor(node)}</strong>
            {node.author?.department && (
              <span className="ml-1 text-[#6b778c]">
                ({node.author.department})
              </span>
            )}
            <span>
              {" · "}
              {new Date(node.createdAt).toLocaleString("ko-KR")}
            </span>
            {node.updatedAt !== node.createdAt && <span> (수정됨)</span>}
          </span>
          {editable && !isEditing && (
            <span>
              <button
                type="button"
                onClick={() => startReply(node.id)}
                className="hover:underline mr-2 text-[#0052cc]"
              >
                답글
              </button>
              <button
                type="button"
                onClick={() => startEdit(node)}
                className="hover:underline mr-2"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => remove.mutate(node.id)}
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
            {node.body}
          </div>
        )}

        {/* FR-073 (Cycle 25) — 댓글 이모지 반응. */}
        {!isEditing && <ReactionBar target="comment" targetId={node.id} />}

        {isReplying && (
          <div className="mt-2">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="답글 입력..."
              className="w-full min-h-[60px] border border-[#dfe1e6] rounded p-2 text-[13px] focus:outline-none focus:border-[#0052cc]"
            />
            <div className="text-right mt-1">
              <button
                type="button"
                onClick={cancelReply}
                className="text-[12px] mr-2 hover:underline"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => submitReply(node.id)}
                disabled={!replyBody.trim() || reply.isPending}
                className="px-3 py-1 bg-[#0052cc] text-white text-[12px] rounded hover:bg-[#0747a6] disabled:bg-[#a5adba]"
              >
                {reply.isPending ? "작성 중..." : "답글 작성"}
              </button>
            </div>
          </div>
        )}

        {node.children.length > 0 && (
          <ul className="space-y-2 mt-2">
            {node.children.map((child) => renderItem(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="mt-8 border-t border-[#dfe1e6] pt-6">
      <h3 className="text-[15px] font-semibold text-[#172b4d] mb-3">
        💬 댓글 ({comments.length}개)
      </h3>

      {/* 댓글 목록 — 작성창 위에 표시 (사용자 요청). */}
      {isLoading ? (
        <div className="text-[12px] text-[#6b778c] mb-4">불러오는 중...</div>
      ) : tree.length === 0 ? (
        <div className="text-[12px] text-[#6b778c] mb-4">
          아직 댓글이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3 mb-4">
          {tree.map((root) => renderItem(root, 0))}
        </ul>
      )}

      {editable && (
        <form onSubmit={submitRoot}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleRootKey}
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
    </section>
  );
}
