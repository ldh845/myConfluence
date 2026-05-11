"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBytes, formatDate } from "@/lib/format";
import { getIdentity } from "@/lib/userIdentity";

// FR-080~083 — 첨부파일 기본 UI.
// 진행률·드래그앤드롭·이미지 미리보기는 8-3 사이클에서 보강.

type Attachment = {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  authorName: string | null;
  createdAt: string;
};

function iconFor(mimetype: string): string {
  if (mimetype.startsWith("image/")) return "🖼️";
  if (mimetype.startsWith("video/")) return "🎞️";
  if (mimetype.startsWith("audio/")) return "🎵";
  if (mimetype === "application/pdf") return "📕";
  if (mimetype.includes("zip") || mimetype.includes("compressed")) return "🗜️";
  if (mimetype.startsWith("text/")) return "📄";
  return "📎";
}

export default function AttachmentList({
  pageId,
  editable,
}: {
  pageId: string;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useQuery<Attachment[]>({
    queryKey: ["attachments", pageId],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${pageId}/attachments`);
      if (!r.ok) throw new Error("failed to load attachments");
      return (await r.json()) as Attachment[];
    },
    enabled: !!pageId,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("authorName", getIdentity().name);
      const r = await fetch(`/api/pages/${pageId}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!r.ok) {
        if (r.status === 413) throw new Error("파일이 너무 큽니다 (최대 100MB).");
        throw new Error("업로드에 실패했습니다.");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", pageId] });
    },
    onError: (err: Error) => {
      window.alert(err.message);
    },
  });

  const remove = useMutation({
    mutationFn: async (att: Attachment) => {
      const r = await fetch(`/api/attachments/${att.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", pageId] });
    },
    onError: () => {
      window.alert("삭제에 실패했습니다.");
    },
  });

  const onPick = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
    // 같은 파일을 다시 선택해도 onChange가 발화하도록 value를 비운다.
    e.target.value = "";
  };

  const items = data ?? [];

  return (
    <section className="mt-10 pt-6 border-t border-[#dfe1e6]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#172b4d] flex items-center gap-1.5">
          <span>📎</span> 첨부파일
          {items.length > 0 && (
            <span className="text-[#6b778c] font-normal">({items.length})</span>
          )}
        </h3>
        {editable && (
          <>
            <button
              onClick={onPick}
              disabled={upload.isPending}
              className="text-xs text-[#0052cc] hover:underline disabled:opacity-50"
            >
              {upload.isPending ? "업로드 중..." : "+ 파일 추가"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={onFileChange}
            />
          </>
        )}
      </div>

      {isLoading ? (
        <div className="text-xs text-[#6b778c] py-4">불러오는 중...</div>
      ) : isError ? (
        <div className="text-xs text-[#de350b] py-4">
          첨부파일을 불러오지 못했습니다.
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-[#6b778c] py-4">
          {editable
            ? '이 페이지에 첨부파일이 없습니다. "+ 파일 추가"로 올려보세요.'
            : "이 페이지에 첨부파일이 없습니다. 편집 모드에서 추가할 수 있습니다."}
        </div>
      ) : (
        <ul className="divide-y divide-[#dfe1e6] border border-[#dfe1e6] rounded">
          {items.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 px-3 py-2 text-[13px]"
            >
              <span className="text-base shrink-0" aria-hidden>
                {iconFor(att.mimetype)}
              </span>
              <div className="flex-1 min-w-0">
                <a
                  href={`/api/attachments/${att.id}`}
                  className="text-[#0052cc] hover:underline truncate block"
                  title={att.filename}
                  download={att.filename}
                >
                  {att.filename}
                </a>
                <div className="text-[11px] text-[#6b778c]">
                  {formatBytes(att.size)} · {att.authorName ?? "익명"} ·{" "}
                  {formatDate(att.createdAt)}
                </div>
              </div>
              {editable && (
                <button
                  onClick={() => {
                    if (window.confirm(`"${att.filename}"을(를) 삭제할까요?`))
                      remove.mutate(att);
                  }}
                  disabled={remove.isPending}
                  className="text-[#6b778c] hover:text-[#de350b] disabled:opacity-50 text-sm shrink-0"
                  aria-label="첨부파일 삭제"
                  title="삭제"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
