"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// FR-071 (Cycle 16-3b-2) — 인라인 댓글 목록 + resolve/unresolve.
// queryKey ["comments", pageId]를 PageComments와 공유해 데이터 갱신 자동 전파.
// FR-001 (Cycle 27d) — author는 JWT user. resolvedBy도 서버가 결정.

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
  isInline: boolean;
  anchorJson: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function displayAuthor(c: Comment): string {
  return c.author?.name ?? c.authorName ?? "익명";
}

type Anchor = { from: number; to: number; text: string };

function parseAnchor(json: string | null): Anchor | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as Anchor;
    if (typeof obj?.text === "string") return obj;
  } catch {
    // ignore — 방어적 fallback (anchor 인용 생략)
  }
  return null;
}

type Props = {
  pageId: string;
  editable: boolean;
};

export default function InlineCommentsList({ pageId, editable }: Props) {
  const queryClient = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);

  const { data } = useQuery<Comment[]>({
    queryKey: ["comments", pageId],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${pageId}/comments`);
      if (!r.ok) return [];
      return (await r.json()) as Comment[];
    },
    enabled: !!pageId,
  });

  const inlineComments = useMemo(() => {
    const list = (data ?? []).filter((c) => c.isInline);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data]);

  const active = inlineComments.filter((c) => !c.resolvedAt);
  const resolved = inlineComments.filter((c) => c.resolvedAt);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["comments", pageId] });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/comments/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        throw new Error("해결 처리에 실패했습니다.");
      }
      return r.json();
    },
    onSuccess: invalidate,
    onError: (err: Error) => window.alert(err.message),
  });

  const unresolve = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/comments/${id}/unresolve`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        throw new Error("해결 취소에 실패했습니다.");
      }
      return r.json();
    },
    onSuccess: invalidate,
    onError: (err: Error) => window.alert(err.message),
  });

  if (inlineComments.length === 0) return null;

  const renderCard = (c: Comment, isResolved: boolean) => {
    const anchor = parseAnchor(c.anchorJson);
    return (
      <li
        key={c.id}
        className={
          "border rounded-md p-3 " +
          (isResolved
            ? "bg-[#f4f5f7] border-[#dfe1e6] opacity-70"
            : "bg-[#fffbe6] border-[#fbc02d]")
        }
      >
        {anchor && (
          <blockquote className="border-l-4 border-[#fbc02d] pl-2 mb-2 text-[11px] text-[#6b778c] italic whitespace-pre-wrap line-clamp-2">
            “{anchor.text}”
          </blockquote>
        )}
        <div className="text-[13px] text-[#172b4d] whitespace-pre-wrap mb-1">
          {c.body}
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#6b778c]">
          <span>
            <strong className="text-[#172b4d]">{displayAuthor(c)}</strong>
            {c.author?.department && (
              <span className="ml-1 text-[#6b778c]">({c.author.department})</span>
            )}
            {" · "}
            {new Date(c.createdAt).toLocaleString("ko-KR")}
            {isResolved && c.resolvedAt && (
              <span className="ml-2 text-[#006644]">
                ✓ 해결됨 ({c.resolvedBy ?? "익명"})
              </span>
            )}
          </span>
          {editable && (
            <span>
              {isResolved ? (
                <button
                  type="button"
                  onClick={() => unresolve.mutate(c.id)}
                  disabled={unresolve.isPending}
                  className="hover:underline text-[#0052cc] disabled:opacity-50"
                >
                  되돌리기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => resolve.mutate(c.id)}
                  disabled={resolve.isPending}
                  className="hover:underline text-[#006644] disabled:opacity-50"
                >
                  해결
                </button>
              )}
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="mt-6 border-t border-[#dfe1e6] pt-4">
      <h3 className="text-[15px] font-semibold text-[#172b4d] mb-3">
        💡 인라인 댓글 ({active.length}
        {resolved.length > 0 && `, 해결됨 ${resolved.length}`})
      </h3>

      {active.length > 0 ? (
        <ul className="space-y-2">{active.map((c) => renderCard(c, false))}</ul>
      ) : (
        <div className="text-[12px] text-[#6b778c]">
          활성 인라인 댓글이 없습니다.
        </div>
      )}

      {resolved.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="text-[12px] text-[#6b778c] hover:underline"
          >
            {showResolved
              ? "▾ 해결된 댓글 숨기기"
              : `▸ 해결된 댓글 ${resolved.length}개 보기`}
          </button>
          {showResolved && (
            <ul className="space-y-2 mt-2">
              {resolved.map((c) => renderCard(c, true))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
