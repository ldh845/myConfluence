"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// FR-024 (Cycle 18-1b) — 휴지통 Sheet.
// 사이드바 하단 🗑️ 버튼으로 토글. 복구 시 사이드바(useState 기반 spaces) 갱신을
// 위해 부모의 loadSpaces callback을 호출. 영구 삭제는 confirm 다이얼로그 필수.

type TrashedPage = {
  id: string;
  title: string;
  spaceId: string;
  parentId: string | null;
  deletedAt: string;
  updatedAt: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRestored?: () => void;
};

export default function TrashSheet({ open, onOpenChange, onRestored }: Props) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<TrashedPage[]>({
    queryKey: ["trash"],
    queryFn: async () => {
      const r = await fetch(`/api/pages/trash`);
      if (!r.ok) return [];
      return (await r.json()) as TrashedPage[];
    },
    enabled: open,
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/pages/${id}/restore`, { method: "POST" });
      if (!r.ok) throw new Error("복구에 실패했습니다.");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      onRestored?.();
    },
    onError: (err: Error) => window.alert(err.message),
  });

  const permanentDelete = useMutation({
    mutationFn: async (id: string) => {
      if (
        !window.confirm(
          "이 페이지를 영구 삭제하시겠습니까?\n\n" +
            "자식 페이지·다이어그램·첨부파일·댓글이 모두 함께 삭제됩니다.\n" +
            "이 작업은 되돌릴 수 없습니다.",
        )
      ) {
        throw new Error("cancel");
      }
      const r = await fetch(`/api/pages/${id}/permanent`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("영구 삭제에 실패했습니다.");
      return r.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["trash"] }),
    onError: (err: Error) => {
      if (err.message === "cancel") return;
      window.alert(err.message);
    },
  });

  const pages = data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:max-w-[420px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>🗑️ 휴지통 ({pages.length}개)</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
          ) : pages.length === 0 ? (
            <div className="text-[12px] text-[#6b778c]">
              휴지통이 비어 있습니다.
            </div>
          ) : (
            pages.map((p) => (
              <article
                key={p.id}
                className="border border-[#dfe1e6] rounded-md p-3 bg-[#f4f5f7]"
              >
                <div className="text-[14px] font-medium text-[#172b4d] truncate">
                  {p.title || "(제목 없음)"}
                </div>
                <div className="text-[11px] text-[#6b778c] mt-1">
                  삭제: {new Date(p.deletedAt).toLocaleString("ko-KR")}
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => restore.mutate(p.id)}
                    disabled={restore.isPending}
                    className="text-[12px] px-2 py-1 rounded border border-[#dfe1e6] text-[#0052cc] hover:bg-[#deebff] disabled:opacity-50"
                  >
                    복구
                  </button>
                  <button
                    type="button"
                    onClick={() => permanentDelete.mutate(p.id)}
                    disabled={permanentDelete.isPending}
                    className="text-[12px] px-2 py-1 rounded border border-[#dfe1e6] text-[#de350b] hover:bg-[#ffebe6] disabled:opacity-50"
                  >
                    영구 삭제
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
