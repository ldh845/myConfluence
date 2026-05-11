"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBytes, formatDate } from "@/lib/format";
import { getIdentity } from "@/lib/userIdentity";

// FR-080~083 — 첨부파일 UX (Cycle 8-3 진행률 / 드래그앤드롭 / 이미지 미리보기).

type Attachment = {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  authorName: string | null;
  createdAt: string;
};

type UploadProgress = { filename: string; percent: number };

function iconFor(mimetype: string): string {
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
  const dragDepth = useRef(0);

  const [uploadingProgress, setUploadingProgress] =
    useState<UploadProgress | null>(null);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const { data, isLoading, isError } = useQuery<Attachment[]>({
    queryKey: ["attachments", pageId],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${pageId}/attachments`);
      if (!r.ok) throw new Error("failed to load attachments");
      return (await r.json()) as Attachment[];
    },
    enabled: !!pageId,
  });

  // FR-080 — XHR로 업로드해야 progress 이벤트를 받는다. fetch는 아직
  // 표준 진행률 API가 없다.
  const upload = useMutation({
    mutationFn: (file: File) =>
      new Promise<Attachment>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadingProgress({
              filename: file.name,
              percent: (e.loaded / e.total) * 100,
            });
          }
        });
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("응답 파싱 실패"));
            }
          } else if (xhr.status === 413) {
            reject(new Error("파일이 너무 큽니다 (최대 100MB)."));
          } else {
            reject(new Error("업로드에 실패했습니다."));
          }
        };
        xhr.onerror = () =>
          reject(new Error("네트워크 오류로 업로드에 실패했습니다."));
        xhr.open("POST", `/api/pages/${pageId}/attachments`);
        const form = new FormData();
        form.append("file", file);
        form.append("authorName", getIdentity().name);
        // 시작과 동시에 0% 카드를 노출. 완료/실패 시에는 finalize 단계에서 제거.
        setUploadingProgress({ filename: file.name, percent: 0 });
        xhr.send(form);
      }),
    onSuccess: () => {
      setUploadingProgress(null);
      queryClient.invalidateQueries({ queryKey: ["attachments", pageId] });
    },
    onError: (err: Error) => {
      setUploadingProgress(null);
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

  // 큐 디스패처: 한 번에 한 파일씩. 한 파일이 실패해도 큐의 나머지는 진행.
  useEffect(() => {
    if (upload.isPending) return;
    if (uploadQueue.length === 0) return;
    const [next, ...rest] = uploadQueue;
    setUploadQueue(rest);
    upload.mutate(next);
  }, [uploadQueue, upload]);

  const enqueue = (files: File[]) => {
    if (!editable || files.length === 0) return;
    setUploadQueue((prev) => [...prev, ...files]);
  };

  const onPick = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    enqueue(files);
    e.target.value = "";
  };

  // 드래그앤드롭. dragenter/leave가 자식 노드 hover 시마다 발화하므로
  // depth 카운터로 진짜 leave만 잡는다.
  const onDragEnter = (e: React.DragEvent) => {
    if (!editable) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!editable) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!editable) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!editable) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    enqueue(files);
  };

  const items = data ?? [];
  const queueWaiting = uploadQueue.length;

  return (
    <section
      className={`mt-10 pt-6 border-t border-[#dfe1e6] relative ${
        editable && isDragging
          ? "ring-2 ring-[#0052cc] ring-offset-2 rounded"
          : ""
      }`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
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
              multiple
              onChange={onFileChange}
            />
          </>
        )}
      </div>

      {editable && isDragging && (
        <div className="pointer-events-none absolute inset-0 mt-10 flex items-center justify-center bg-[#deebff]/70 text-[#0052cc] text-sm font-medium rounded">
          여기에 파일을 놓으세요
        </div>
      )}

      {uploadingProgress && (
        <div className="mb-3 border border-[#dfe1e6] rounded-md p-3 bg-[#f4f8ff]">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-[#172b4d] truncate">
              {uploadingProgress.filename}
            </span>
            <span className="text-[#6b778c] shrink-0 ml-2">
              {uploadingProgress.percent.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 bg-[#deebff] rounded mt-2 overflow-hidden">
            <div
              className="h-full bg-[#0052cc] transition-[width] duration-150"
              style={{ width: `${uploadingProgress.percent}%` }}
            />
          </div>
          {queueWaiting > 0 && (
            <div className="text-[11px] text-[#6b778c] mt-1.5">
              대기 중: {queueWaiting}개
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-[#6b778c] py-4">불러오는 중...</div>
      ) : isError ? (
        <div className="text-xs text-[#de350b] py-4">
          첨부파일을 불러오지 못했습니다.
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-[#6b778c] py-4">
          {editable
            ? '이 페이지에 첨부파일이 없습니다. "+ 파일 추가" 또는 드래그앤드롭으로 올려보세요.'
            : "이 페이지에 첨부파일이 없습니다. 편집 모드에서 추가할 수 있습니다."}
        </div>
      ) : (
        <ul className="divide-y divide-[#dfe1e6] border border-[#dfe1e6] rounded">
          {items.map((att) => {
            const isImage = att.mimetype.startsWith("image/");
            return (
              <li
                key={att.id}
                className="flex items-center gap-3 px-3 py-2 text-[13px]"
              >
                {isImage ? (
                  // FR-082 — 이미지는 카드 썸네일로 인라인 미리보기.
                  // src는 다운로드 endpoint 그대로. 인증 도입 시 토큰 처리 검토.
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/attachments/${att.id}`}
                    alt={att.filename}
                    loading="lazy"
                    className="w-12 h-12 rounded object-cover bg-[#f4f5f7] shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-[#f4f5f7] flex items-center justify-center text-2xl shrink-0">
                    {iconFor(att.mimetype)}
                  </div>
                )}
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
            );
          })}
        </ul>
      )}
    </section>
  );
}
