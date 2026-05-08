"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getIdentity } from "@/lib/userIdentity";
import PageVersionDiff from "@/components/PageVersionDiff";

// FR-061 / FR-063 — 페이지 버전 히스토리 + 원복 다이얼로그.
// 비교(FR-062), 보관 정책(FR-064)은 다음 사이클.

type PageVersion = {
  id: string;
  pageId: string;
  title: string;
  content: string;
  authorName: string | null;
  version: number;
  createdAt: string;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  pageId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export default function PageVersionHistory({
  pageId,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<PageVersion | null>(null);
  // FR-062 — 카드별 diff 패널 펼침 상태. 한 번에 하나만 펼친다.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PageVersion[]>({
    queryKey: ["page-versions", pageId],
    queryFn: async () => {
      const res = await fetch(`/api/pages/${pageId}/versions`);
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as PageVersion[];
    },
    enabled: !!pageId && open,
  });

  const restore = useMutation({
    mutationFn: async (version: PageVersion) => {
      const identity = getIdentity();
      const res = await fetch(
        `/api/pages/${version.pageId}/versions/${version.id}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ authorName: identity.name }),
        },
      );
      if (!res.ok) throw new Error("restore failed");
      return res.json();
    },
    onSuccess: (_data, version) => {
      queryClient.invalidateQueries({
        queryKey: ["page-versions", version.pageId],
      });
      setTarget(null);
      window.alert(
        `v${version.version}으로 복원되었습니다. 페이지를 새로고침하세요.`,
      );
    },
    onError: () => {
      window.alert("복원에 실패했습니다. 잠시 후 다시 시도해주세요.");
    },
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-[420px] sm:max-w-[420px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>버전 히스토리</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {isLoading && (
              <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
            )}
            {isError && (
              <div className="text-[12px] text-[#de350b]">
                버전을 불러오지 못했습니다.
              </div>
            )}
            {data && data.length === 0 && (
              <div className="text-[12px] text-[#6b778c]">
                아직 저장된 버전이 없습니다.
              </div>
            )}
            {data?.map((v, i) => {
              const expanded = expandedId === v.id;
              // 목록은 version DESC. 직전 버전은 한 칸 뒤(i+1).
              const previous = data[i + 1];
              const isOldest = !previous;
              return (
                <article
                  key={v.id}
                  className="border border-[#dfe1e6] rounded-md p-3 hover:border-[#0052cc] transition-colors"
                >
                  <header className="flex items-center justify-between text-[12px]">
                    <span className="inline-flex items-center gap-1 text-[#172b4d] font-semibold">
                      <span className="px-1.5 py-0.5 rounded bg-[#deebff] text-[#0052cc] text-[11px]">
                        v{v.version}
                      </span>
                      {v.title}
                    </span>
                    <span className="text-[#6b778c]">
                      {formatDateTime(v.createdAt)}
                    </span>
                  </header>
                  <div className="mt-1.5 text-[11px] text-[#6b778c]">
                    작성자: {v.authorName ?? "익명"}
                  </div>
                  {v.content && (
                    <p className="mt-2 text-[12px] text-[#42526e] whitespace-pre-wrap line-clamp-3">
                      {v.content.slice(0, 100)}
                      {v.content.length > 100 ? "…" : ""}
                    </p>
                  )}
                  <div className="mt-2 flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId((prev) => (prev === v.id ? null : v.id))
                      }
                      className="text-[11px] px-2 py-1 rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#ebecf0]"
                    >
                      {expanded ? "비교 닫기" : "비교"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTarget(v)}
                      disabled={restore.isPending}
                      className="text-[11px] px-2 py-1 rounded border border-[#dfe1e6] text-[#0052cc] hover:bg-[#deebff] disabled:opacity-50"
                    >
                      이 버전으로 복원
                    </button>
                  </div>
                  {expanded &&
                    (isOldest ? (
                      <div className="mt-2 text-[11px] text-[#6b778c]">
                        이전 버전 없음 (최초 생성)
                      </div>
                    ) : (
                      <PageVersionDiff
                        oldContent={previous.content}
                        newContent={v.content}
                      />
                    ))}
                </article>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!target}
        onOpenChange={(o) => {
          if (!o) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              v{target?.version}으로 복원하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription>
              원복 후 새로운 버전이 기록되며, 다른 편집자가 있으면 변경이
              충돌할 수 있습니다. 복원 후 페이지를 새로고침하는 것을
              권장합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restore.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={restore.isPending}
              onClick={(e) => {
                // Radix 기본 동작: action 클릭 시 dialog가 자동 닫힘.
                // mutation을 먼저 트리거한 뒤 닫히는 흐름이 자연스럽다.
                e.preventDefault();
                if (target) restore.mutate(target);
              }}
            >
              {restore.isPending ? "복원 중..." : "복원"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
