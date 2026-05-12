"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SpaceWithPages, PageNode } from "@/lib/types";

// FR-022 (Cycle 18-3b) — 페이지 이동 다이얼로그.
// 18-3a backend: PATCH /pages/:id {spaceId?, parentId?} — 자손 spaceId 동기화 +
// 순환/스페이스 일치 검증. 클라이언트에서도 자기/자손을 부모 옵션에서 사전 제거해
// 백엔드 400을 사실상 회피한다.

type MovablePage = {
  id: string;
  title: string;
  spaceId: string;
  parentId: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  page: MovablePage;
  onMoved?: () => void;
};

// 한국어 에러 메시지 매핑 (백엔드 400/404 응답 본문의 error 문자열).
const ERROR_MAP: Record<string, string> = {
  "cannot be parent of itself": "자기 자신을 부모로 지정할 수 없습니다.",
  "cannot move under own descendant":
    "자기 자신의 하위 페이지로는 이동할 수 없습니다.",
  "parent must be in target space":
    "선택한 부모 페이지는 대상 스페이스에 있어야 합니다.",
  "target space not found": "대상 스페이스를 찾을 수 없습니다.",
  "parent page not found": "부모 페이지를 찾을 수 없습니다.",
  "page not found": "페이지를 찾을 수 없습니다.",
};

type FlatPage = { id: string; title: string; depth: number };

// SpaceWithPages.pages(평탄 배열) → 트리 → DFS 평탄화(depth 포함).
function flattenTree(pages: PageNode[]): FlatPage[] {
  type Node = PageNode & { children: Node[] };
  const byId = new Map<string, Node>();
  pages.forEach((p) => byId.set(p.id, { ...p, children: [] }));
  const roots: Node[] = [];
  byId.forEach((n) => {
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId)!.children.push(n);
    } else {
      roots.push(n);
    }
  });
  const flat: FlatPage[] = [];
  const visit = (n: Node, depth: number) => {
    flat.push({ id: n.id, title: n.title, depth });
    n.children.forEach((c) => visit(c, depth + 1));
  };
  roots.forEach((r) => visit(r, 0));
  return flat;
}

// 자기 자신과 자손 id 집합 — 부모 옵션에서 제외용.
function collectSubtreeIds(pages: PageNode[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  pages.forEach((p) => {
    if (!p.parentId) return;
    const arr = childrenByParent.get(p.parentId) ?? [];
    arr.push(p.id);
    childrenByParent.set(p.parentId, arr);
  });
  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const kids = childrenByParent.get(cur) ?? [];
    for (const k of kids) {
      if (!result.has(k)) {
        result.add(k);
        queue.push(k);
      }
    }
  }
  return result;
}

export default function MovePageDialog({
  open,
  onOpenChange,
  page,
  onMoved,
}: Props) {
  const queryClient = useQueryClient();
  const [targetSpaceId, setTargetSpaceId] = useState(page.spaceId);
  const [targetParentId, setTargetParentId] = useState<string | null>(
    page.parentId,
  );

  useEffect(() => {
    if (open) {
      setTargetSpaceId(page.spaceId);
      setTargetParentId(page.parentId);
    }
  }, [open, page.spaceId, page.parentId]);

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces-list"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
    enabled: open,
  });

  // 대상 스페이스의 페이지 트리를 평탄화한 뒤 자기/자손 제외.
  const parentOptions = useMemo<FlatPage[]>(() => {
    const space = (spaces ?? []).find((s) => s.id === targetSpaceId);
    if (!space) return [];
    const excluded =
      space.id === page.spaceId
        ? collectSubtreeIds(space.pages, page.id)
        : new Set<string>();
    return flattenTree(space.pages).filter((n) => !excluded.has(n.id));
  }, [spaces, targetSpaceId, page.id, page.spaceId]);

  // 스페이스 전환 시 parent를 루트로 리셋(현재 스페이스의 부모는 새 스페이스에 없음).
  useEffect(() => {
    if (targetSpaceId !== page.spaceId) {
      setTargetParentId(null);
    }
  }, [targetSpaceId, page.spaceId]);

  const move = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          spaceId: targetSpaceId,
          parentId: targetParentId,
        }),
      });
      if (!r.ok) {
        let msg = "이동에 실패했습니다.";
        try {
          const body = (await r.json()) as { error?: string };
          if (body?.error) msg = ERROR_MAP[body.error] ?? body.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["spaces-list"] });
      onMoved?.();
      onOpenChange(false);
      window.alert("이동되었습니다.");
    },
    onError: (err: Error) => window.alert(err.message),
  });

  const noChange =
    targetSpaceId === page.spaceId && targetParentId === page.parentId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>페이지 이동</DialogTitle>
        </DialogHeader>

        <section className="space-y-2">
          <label className="block text-[12px] font-semibold text-[#42526e]">
            대상 스페이스
          </label>
          <select
            value={targetSpaceId}
            onChange={(e) => setTargetSpaceId(e.target.value)}
            className="w-full px-2 py-1.5 text-[13px] border border-[#dfe1e6] rounded bg-white focus:outline-none focus:border-[#0052cc]"
          >
            {(spaces ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-2">
          <label className="block text-[12px] font-semibold text-[#42526e]">
            부모 페이지
          </label>
          <select
            value={targetParentId ?? ""}
            onChange={(e) =>
              setTargetParentId(e.target.value === "" ? null : e.target.value)
            }
            className="w-full px-2 py-1.5 text-[13px] border border-[#dfe1e6] rounded bg-white focus:outline-none focus:border-[#0052cc]"
          >
            <option value="">최상위(루트)</option>
            {parentOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {"  ".repeat(n.depth)}
                {n.title || "(제목 없음)"}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-[#6b778c]">
            자기 자신과 하위 페이지는 부모 옵션에서 제외됩니다.
          </p>
        </section>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#ebecf0]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => move.mutate()}
            disabled={noChange || move.isPending}
            className="px-3 py-1 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
          >
            {move.isPending ? "이동 중..." : "이동"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
