"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// FR-061 — 페이지 버전 히스토리 슬라이드 패널.
// 원복(FR-063), 비교(FR-062), 보관 정책(FR-064)은 다음 사이클.

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
  const { data, isLoading, isError } = useQuery<PageVersion[]>({
    queryKey: ["page-versions", pageId],
    queryFn: async () => {
      const res = await fetch(`/api/pages/${pageId}/versions`);
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as PageVersion[];
    },
    enabled: !!pageId && open,
  });

  return (
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
          {data?.map((v) => (
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
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
