"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getIdentity } from "@/lib/userIdentity";

// Cycle 54-C — 파일/그림 통합 삽입 다이얼로그.
//   탭 1 '이 페이지 첨부' — 페이지의 첨부 중 이미지만 그리드로 표시, '+ 새 업로드'
//   탭 2 '웹에서의 그림' — URL 입력 + 미리보기 + 삽입
//   onSelect 가 src(+ alt) 받아 호출부가 image 노드 삽입.
//
// 진입점: EditorToolbar ImageButton, slash '이미지' (54-C-1 에서 연결).
// 첨부 업로드는 AttachmentList 와 동일 endpoint(POST /api/pages/:id/attachments)
// 재활용 — 같은 ['attachments', pageId] queryKey 라 양쪽 자동 동기화.

type Attachment = {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  authorName: string | null;
  createdAt: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pageId: string;
  onSelect: (src: string, alt?: string) => void;
};

type Tab = "attached" | "url";

export default function ImageInsertDialog({
  open,
  onOpenChange,
  pageId,
  onSelect,
}: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("attached");
  const [url, setUrl] = useState("");
  const [urlAlt, setUrlAlt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingName, setUploadingName] = useState<string | null>(null);

  // 모달 열릴 때 상태 초기화.
  useEffect(() => {
    if (open) {
      setTab("attached");
      setUrl("");
      setUrlAlt("");
      setUploadingName(null);
    }
  }, [open]);

  const { data: attachments } = useQuery<Attachment[]>({
    queryKey: ["attachments", pageId],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${pageId}/attachments`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      return (await r.json()) as Attachment[];
    },
    enabled: !!pageId && open,
  });

  const images = (attachments ?? []).filter((a) =>
    a.mimetype.startsWith("image/"),
  );

  // 첨부 업로드 — AttachmentList 와 동일 endpoint. 단순화: progress 무시.
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("authorName", getIdentity().name);
      const r = await fetch(`/api/pages/${pageId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error("로그인이 필요합니다.");
        if (r.status === 413) throw new Error("파일이 너무 큽니다 (최대 100MB).");
        throw new Error("업로드에 실패했습니다.");
      }
      return (await r.json()) as Attachment;
    },
    onSuccess: (att) => {
      setUploadingName(null);
      queryClient.invalidateQueries({ queryKey: ["attachments", pageId] });
      // 이미지면 그대로 삽입까지 — UX 자연스러움.
      if (att.mimetype.startsWith("image/")) {
        onSelect(`/api/attachments/${att.id}`, att.filename);
        onOpenChange(false);
      }
    },
    onError: (err: Error) => {
      setUploadingName(null);
      window.alert(err.message);
    },
  });

  const onPickFile = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("이미지 파일만 업로드 가능합니다.");
      return;
    }
    setUploadingName(file.name);
    upload.mutate(file);
  };

  const onPickAttachment = (att: Attachment) => {
    onSelect(`/api/attachments/${att.id}`, att.filename);
    onOpenChange(false);
  };

  const onInsertUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSelect(trimmed, urlAlt.trim() || undefined);
    onOpenChange(false);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "attached", label: "이 페이지 첨부" },
    { id: "url", label: "웹에서의 그림" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>파일과 그림 삽입</DialogTitle>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="이미지 삽입 종류"
          className="flex items-center gap-1 border-b border-[#dfe1e6] -mt-1"
        >
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-[13px] border-b-2 -mb-px ${
                  active
                    ? "border-[#0052cc] text-[#0052cc] font-semibold"
                    : "border-transparent text-[#42526e] hover:text-[#172b4d]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "attached" && (
          <section className="space-y-3" role="tabpanel">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-[#6b778c]">
                이 페이지의 첨부 이미지 중에서 선택합니다.
              </div>
              <button
                type="button"
                onClick={onPickFile}
                disabled={upload.isPending}
                className="px-3 py-1.5 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
              >
                {upload.isPending ? "업로드 중..." : "+ 새 이미지 업로드"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={onFileChange}
              />
            </div>

            {uploadingName && (
              <div className="text-[11px] text-[#6b778c]">
                업로드 중: {uploadingName}
              </div>
            )}

            {images.length === 0 ? (
              <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-6 text-center">
                이 페이지에 첨부된 이미지가 없습니다.
                <br />
                위의 &lsquo;+ 새 이미지 업로드&rsquo; 또는 &lsquo;웹에서의 그림&rsquo; 탭을 사용하세요.
              </div>
            ) : (
              <div
                className="grid gap-2 max-h-[360px] overflow-y-auto p-1"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
              >
                {images.map((att) => (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => onPickAttachment(att)}
                    title={att.filename}
                    className="border border-[#dfe1e6] rounded overflow-hidden hover:border-[#0052cc] hover:ring-2 hover:ring-[#deebff] focus:outline-none focus:border-[#0052cc]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/attachments/${att.id}`}
                      alt={att.filename}
                      loading="lazy"
                      className="w-full h-24 object-cover bg-[#f4f5f7] block"
                    />
                    <div className="text-[11px] text-[#172b4d] truncate px-1.5 py-1 text-left">
                      {att.filename}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "url" && (
          <section className="space-y-3" role="tabpanel">
            <div className="text-[12px] text-[#6b778c]">
              외부 그림 URL(http/https)을 입력합니다.
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onInsertUrl();
                }
              }}
              placeholder="https://example.com/image.png"
              className="w-full px-3 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
              autoFocus
            />
            <input
              type="text"
              value={urlAlt}
              onChange={(e) => setUrlAlt(e.target.value)}
              placeholder="대체 텍스트 (선택)"
              className="w-full px-3 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
            />
            {url.trim() && (
              <div className="border border-[#dfe1e6] rounded p-2 bg-[#f4f5f7] text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url.trim()}
                  alt="미리보기"
                  className="max-h-[200px] mx-auto block"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onInsertUrl}
                disabled={!url.trim()}
                className="px-3 py-1.5 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
              >
                삽입
              </button>
            </div>
          </section>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#ebecf0]"
          >
            취소
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
