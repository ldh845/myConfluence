"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePageStore } from "@/lib/stores/usePageStore";
import { formatBytes } from "@/lib/format";

// FR-034 (Cycle 11-1) — 링크 modal. 외부 URL + 내부 페이지 검색.
// onSelect(null)은 링크 제거. 페이지 클릭 시 href는 `/?pageId=<id>` 형식이며
// SPA 라우팅은 Cycle 11-2에서 useSearchParams로 동기화.
//
// Cycle 54-A — Confluence 표준 탭 UI 로 재구성.
//   탭: '연결 문구(내부 페이지)' / '웹 연결(외부 URL)'.
// Cycle 62 — '파일' 탭 추가. 현재 페이지의 첨부를 링크로 연결
//   (href = /api/attachments/:id). pageId 는 usePageStore.
//   기본 탭: currentHref 가 외부 URL(http(s)://) 이면 '웹 연결', 그 외에는
//   '연결 문구' (새 링크 / 내부 경로 / 빈 값 모두 내부 검색을 우선 노출).

type SearchResult = {
  id: string;
  title: string;
  spaceId: string;
  updatedAt: string;
};

type Attachment = {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (href: string | null, text?: string) => void;
  currentHref?: string;
  currentText?: string;
  // Cycle XX — 텍스트가 선택된 상태에서 링크 버튼 누르면 이 값으로 연결 문구 초기화.
  selectedText?: string;
};

type Tab = "internal" | "external" | "file";

function pickDefaultTab(href: string | undefined): Tab {
  if (!href) return "internal";
  const trimmed = href.trim();
  // 외부 URL(http/https) → '웹 연결'. 빈 값·내부 경로(/?pageId=…) 모두 '연결 문구'.
  if (/^https?:\/\//i.test(trimmed)) return "external";
  return "internal";
}

export default function InternalPageLinkDialog({
  open,
  onOpenChange,
  onSelect,
  currentHref,
  currentText,
  selectedText,
}: Props) {
  const [tab, setTab] = useState<Tab>("internal");
  const [url, setUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // 모달이 열릴 때 현재 링크/선택 상태를 입력 필드에 채워 넣어 수정 흐름을 살림.
  useEffect(() => {
    if (open) {
      setTab(pickDefaultTab(currentHref));
      setUrl(currentHref ?? "");
      // 선택 텍스트 > 기존 링크 텍스트 > 빈 값
      setLinkText(selectedText || currentText || "");
      setQ("");
      setDebouncedQ("");
    }
  }, [open, currentHref, currentText, selectedText]);

  // 250ms debounce — 외부 라이브러리 없이 setTimeout으로.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery<SearchResult[]>({
    queryKey: ["pages-search", debouncedQ],
    queryFn: async () => {
      const r = await fetch(
        `/api/pages/search?q=${encodeURIComponent(debouncedQ)}`,
      );
      if (!r.ok) return [];
      return (await r.json()) as SearchResult[];
    },
    enabled: debouncedQ.trim().length >= 1,
  });

  // Cycle 62 — '파일' 탭: 현재 페이지의 첨부 목록. pageId 는 store 에서.
  const pageId = usePageStore((s) => s.pageId);
  const { data: attachments } = useQuery<Attachment[]>({
    queryKey: ["attachments", pageId],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${pageId}/attachments`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      return (await r.json()) as Attachment[];
    },
    enabled: !!pageId && open && tab === "file",
  });

  const applyFile = (attId: string, filename?: string) => {
    onSelect(`/api/attachments/${attId}`, linkText.trim() || filename || undefined);
    onOpenChange(false);
  };

  const applyExternal = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const text = linkText.trim();
    onSelect(trimmed, text || undefined);
    onOpenChange(false);
  };

  const applyInternal = (pageId: string, selectedTitle?: string) => {
    onSelect(`/?pageId=${pageId}`, linkText.trim() || selectedTitle || undefined);
    onOpenChange(false);
  };

  const removeLink = () => {
    onSelect(null);
    onOpenChange(false);
  };

  // 탭 라벨/title — 사용자에게 일관된 명명을 위해 한 곳에서 관리.
  const tabs = useMemo<{ id: Tab; label: string; hint: string }[]>(
    () => [
      {
        id: "internal",
        label: "연결 문구",
        hint: "이 위키 안의 페이지를 검색해 연결",
      },
      {
        id: "external",
        label: "웹 연결",
        hint: "외부 URL(http/https) 연결",
      },
      {
        id: "file",
        label: "파일",
        hint: "이 페이지의 첨부 파일에 연결",
      },
    ],
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>링크</DialogTitle>
        </DialogHeader>

        {/* Cycle 54-A — Confluence 표준 탭 헤더. */}
        <div
          role="tablist"
          aria-label="링크 종류"
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
                title={t.hint}
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

        {tab === "internal" && (
          <section className="space-y-3" role="tabpanel">
            <div className="text-[12px] text-[#6b778c]">
              이 위키 안의 페이지를 검색해 연결합니다.
            </div>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="페이지 제목 일부 입력..."
              className="w-full px-3 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
              autoFocus
            />
            <div className="max-h-[200px] overflow-y-auto border border-[#dfe1e6] rounded">
              {debouncedQ.trim().length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#6b778c]">
                  검색어를 입력하세요.
                </div>
              ) : isFetching ? (
                <div className="px-3 py-2 text-[12px] text-[#6b778c]">
                  검색 중...
                </div>
              ) : !data || data.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#6b778c]">
                  결과가 없습니다.
                </div>
              ) : (
                <ul>
                  {data.map((page) => (
                    <li key={page.id}>
                      <button
                        type="button"
                        onClick={() => applyInternal(page.id, page.title)}
                        className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#ebecf0] border-b border-[#dfe1e6] last:border-b-0"
                      >
                        <div className="text-[#172b4d] font-medium">
                          {page.title}
                        </div>
                        <div className="text-[11px] text-[#6b778c]">
                          /?pageId={page.id}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-[12px] text-[#6b778c] mb-1">
                연결 문구 (비우면 선택한 페이지 제목이 표시됨)
              </label>
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="클릭할 때 보이는 텍스트"
                className="w-full px-3 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
              />
            </div>
          </section>
        )}

        {tab === "external" && (
          <section className="space-y-3" role="tabpanel">
            <div className="text-[12px] text-[#6b778c]">
              외부 URL(http/https)을 입력해 연결합니다.
            </div>
            <div>
              <label className="block text-[12px] text-[#6b778c] mb-1">
                URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyExternal();
                  }
                }}
                placeholder="https://example.com"
                className="w-full px-3 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#6b778c] mb-1">
                연결 문구 (비우면 URL 자체가 표시됨)
              </label>
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="클릭할 때 보이는 텍스트"
                className="w-full px-3 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={applyExternal}
                disabled={!url.trim()}
                className="px-4 py-1.5 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
              >
                적용
              </button>
            </div>
          </section>
        )}

        {tab === "file" && (
          <section className="space-y-3" role="tabpanel">
            <div className="text-[12px] text-[#6b778c]">
              이 페이지의 첨부 파일에 연결합니다.
            </div>
            <div className="max-h-[240px] overflow-y-auto border border-[#dfe1e6] rounded">
              {!pageId ? (
                <div className="px-3 py-2 text-[12px] text-[#6b778c]">
                  페이지를 먼저 선택하세요.
                </div>
              ) : !attachments || attachments.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#6b778c]">
                  이 페이지에 첨부 파일이 없습니다.
                </div>
              ) : (
                <ul>
                  {attachments.map((att) => (
                    <li key={att.id}>
                      <button
                        type="button"
                        onClick={() => applyFile(att.id, att.filename)}
                        className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#ebecf0] border-b border-[#dfe1e6] last:border-b-0"
                      >
                        <div className="text-[#172b4d] font-medium truncate">
                          {att.filename}
                        </div>
                        <div className="text-[11px] text-[#6b778c]">
                          {formatBytes(att.size)} · {att.mimetype}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-[12px] text-[#6b778c] mb-1">
                연결 문구 (비우면 파일명이 표시됨)
              </label>
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="클릭할 때 보이는 텍스트"
                className="w-full px-3 py-1.5 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
              />
            </div>
          </section>
        )}

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={removeLink}
            className="px-3 py-1.5 text-[12px] rounded text-[#de350b] hover:bg-[#ffebe6]"
          >
            링크 제거
          </button>
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
