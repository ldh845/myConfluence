"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PageNode, SpaceWithPages } from "@/lib/types";

// FR-023 (Cycle 18-4b) — 페이지 복사 다이얼로그.
// 18-4a backend: POST /pages/:id/copy {targetSpaceId?, targetParentId?, title?, recursive?}
// MovePageDialog와 유사한 트리 평탄화 + 자손 필터링을 쓰되, 자손 제외는
// recursive=true 일 때만 (recursive=false면 자기 자식으로 복사 허용).

type CopiablePage = {
  id: string;
  title: string;
  spaceId: string;
  parentId: string | null;
};

type CopiedRoot = { id: string; spaceId: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  page: CopiablePage;
  onCopied?: (newPage: CopiedRoot) => void;
};

const ERROR_MAP: Record<string, string> = {
  "page not found": "원본 페이지를 찾을 수 없습니다.",
  "target space not found": "대상 스페이스를 찾을 수 없습니다.",
  "parent page not found": "부모 페이지를 찾을 수 없습니다.",
  "parent must be in target space":
    "선택한 부모 페이지는 대상 스페이스에 있어야 합니다.",
  "cannot copy under own descendant":
    "자기 자신의 하위 페이지로는 복사할 수 없습니다.",
};

type FlatPage = { id: string; title: string; depth: number };

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

export default function CopyPageDialog({
  open,
  onOpenChange,
  page,
  onCopied,
}: Props) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState(`${page.title} (복사본)`);
  const [recursive, setRecursive] = useState(false);
  const [targetSpaceId, setTargetSpaceId] = useState(page.spaceId);
  const [targetParentId, setTargetParentId] = useState<string | null>(
    page.parentId,
  );

  useEffect(() => {
    if (open) {
      setNewTitle(`${page.title} (복사본)`);
      setRecursive(false);
      setTargetSpaceId(page.spaceId);
      setTargetParentId(page.parentId);
    }
  }, [open, page.title, page.spaceId, page.parentId]);

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces-list"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
    enabled: open,
  });

  // recursive=true & 같은 스페이스일 때만 자기/자손 필터. recursive=false면
  // 자기 자식으로 복사 가능.
  const parentOptions = useMemo<FlatPage[]>(() => {
    const space = (spaces ?? []).find((s) => s.id === targetSpaceId);
    if (!space) return [];
    const excluded =
      recursive && space.id === page.spaceId
        ? collectSubtreeIds(space.pages, page.id)
        : new Set<string>();
    return flattenTree(space.pages).filter((n) => !excluded.has(n.id));
  }, [spaces, targetSpaceId, recursive, page.id, page.spaceId]);

  useEffect(() => {
    if (targetSpaceId !== page.spaceId) {
      setTargetParentId(null);
    }
  }, [targetSpaceId, page.spaceId]);

  // recursive 토글로 자기/자손 옵션이 사라지면 선택값을 루트로 리셋.
  useEffect(() => {
    if (recursive && targetParentId) {
      const space = (spaces ?? []).find((s) => s.id === targetSpaceId);
      if (space && space.id === page.spaceId) {
        const excluded = collectSubtreeIds(space.pages, page.id);
        if (excluded.has(targetParentId)) {
          setTargetParentId(null);
        }
      }
    }
  }, [recursive, targetSpaceId, targetParentId, spaces, page.id, page.spaceId]);

  const copy = useMutation<CopiedRoot, Error>({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        targetSpaceId,
        targetParentId,
        recursive,
      };
      const t = newTitle.trim();
      if (t) body.title = t;
      const r = await fetch(`/api/pages/${page.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        let msg = "복사에 실패했습니다.";
        try {
          const eb = (await r.json()) as { error?: string };
          if (eb?.error) msg = ERROR_MAP[eb.error] ?? eb.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      return (await r.json()) as CopiedRoot;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["spaces-list"] });
      onCopied?.(data);
      onOpenChange(false);
      window.alert("복사되었습니다.");
    },
    onError: (err) => window.alert(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>페이지 복사</DialogTitle>
        </DialogHeader>

        <section className="space-y-2">
          <label className="block text-[12px] font-semibold text-[#42526e]">
            새 제목
          </label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={`${page.title} (복사본)`}
            className="w-full px-2 py-1.5 text-[13px] border border-[#dfe1e6] rounded bg-white focus:outline-none focus:border-[#0052cc]"
          />
        </section>

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
                {"  ".repeat(n.depth)}
                {n.title || "(제목 없음)"}
              </option>
            ))}
          </select>
        </section>

        <label className="flex items-center gap-2 text-[13px] text-[#172b4d]">
          <input
            type="checkbox"
            checked={recursive}
            onChange={(e) => setRecursive(e.target.checked)}
          />
          하위 페이지까지 함께 복사
        </label>

        <p className="text-[11px] text-[#6b778c]">
          첨부파일과 다이어그램은 깊은 복사됩니다. 댓글·버전 히스토리는 복사되지
          않습니다.
        </p>

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
            onClick={() => copy.mutate()}
            disabled={copy.isPending}
            className="px-3 py-1 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
          >
            {copy.isPending ? "복사 중..." : "복사"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
