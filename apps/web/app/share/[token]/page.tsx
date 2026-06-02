"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// FR-120 (Cycle 23) — 공유 페이지 읽기 전용 뷰.
// 사이드바·편집·댓글 없이 본문만 + 다이어그램 + 첨부 다운로드.
// 토큰 만료/폐기/페이지 삭제 시 안내 페이지로 분기.

type SharedDiagram = {
  id: string;
  title: string;
  preview: string | null;
};

type SharedAttachment = {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
};

type ShareResponse = {
  page: {
    id: string;
    title: string;
    content: string;
    spaceName: string | null;
  };
  diagrams: SharedDiagram[];
  attachments: SharedAttachment[];
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function SharedPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  const { data, isLoading, error } = useQuery<
    ShareResponse,
    { status?: number; message: string }
  >({
    queryKey: ["share", token],
    queryFn: async () => {
      const r = await fetch(`/api/share/${token}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw {
          status: r.status,
          message: (body as { error?: string }).error ?? "오류가 발생했습니다.",
        };
      }
      return (await r.json()) as ShareResponse;
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[13px] text-[#6b778c]">
        불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="w-12 h-12 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold text-lg">
          M
        </div>
        <div className="text-[18px] font-semibold text-[#172b4d]">
          공유 페이지에 접근할 수 없습니다
        </div>
        <div className="text-[13px] text-[#6b778c]">
          {error.status === 410
            ? "공유가 종료되었거나 페이지가 삭제되었습니다."
            : "잘못되거나 만료된 링크입니다."}
        </div>
        <Link
          href="/"
          className="mt-3 text-[12px] text-[#0052cc] hover:underline"
        >
          DocSpace 홈으로
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#f4f5f7] border-b border-[#dfe1e6] px-6 py-2 text-[11px] text-[#6b778c] flex items-center gap-2 no-print">
        <Link
          href="/"
          className="flex items-center gap-1.5 hover:text-[#0052cc]"
        >
          <div className="w-5 h-5 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold text-[10px]">
            M
          </div>
          <span className="font-semibold">myConfluence</span>
        </Link>
        <span>·</span>
        <span>🔗 공유된 페이지 (읽기 전용)</span>
        {data.page.spaceName && (
          <>
            <span>·</span>
            <span>{data.page.spaceName}</span>
          </>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-[28px] font-semibold text-[#172b4d] mb-6">
          {data.page.title}
        </h1>

        <article className="cf-article prose prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {data.page.content}
          </ReactMarkdown>
        </article>

        {data.diagrams.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[16px] font-semibold text-[#172b4d] mb-3">
              📐 다이어그램
            </h2>
            <div className="space-y-4">
              {data.diagrams.map((d) => (
                <div
                  key={d.id}
                  className="border border-[#dfe1e6] rounded-md p-3"
                >
                  <div className="text-[13px] font-medium text-[#172b4d] mb-2">
                    {d.title}
                  </div>
                  {d.preview ? (
                    <div
                      className="diagram-preview"
                      dangerouslySetInnerHTML={{ __html: d.preview }}
                    />
                  ) : (
                    <div className="text-[12px] text-[#6b778c]">
                      미리보기 없음
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.attachments.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[16px] font-semibold text-[#172b4d] mb-3">
              📎 첨부파일
            </h2>
            <ul className="space-y-2">
              {data.attachments.map((a) => (
                <li
                  key={a.id}
                  className="border border-[#dfe1e6] rounded-md px-3 py-2 flex items-center justify-between"
                >
                  <span className="text-[13px] text-[#172b4d] truncate">
                    📎 {a.filename}
                  </span>
                  <a
                    href={`/api/share/${token}/attachments/${a.id}`}
                    className="text-[12px] text-[#0052cc] hover:underline no-print"
                  >
                    {a.mimetype} · {formatSize(a.size)} ↓
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-12 pt-4 border-t border-[#dfe1e6] text-[11px] text-[#6b778c] no-print">
          이 페이지는{" "}
          <Link href="/" className="text-[#0052cc] hover:underline">
            myConfluence
          </Link>
          에서 공유한 읽기 전용 페이지입니다.
        </footer>
      </main>
    </div>
  );
}
