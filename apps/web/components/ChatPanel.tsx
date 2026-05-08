"use client";

import { useState } from "react";

type Source = { id: string; title: string };
type Msg = {
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
};

type Props = {
  open: boolean;
  onToggle: () => void;
  onOpenPage: (pageId: string) => void;
};

export default function ChatPanel({ open, onToggle, onOpenPage }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: `오류: ${data.error ?? "unknown"}` },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: data.answer ?? "",
            sources: data.sources ?? [],
          },
        ]);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `오류: ${(e as Error).message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <aside className="w-10 shrink-0 border-l border-[#dfe1e6] bg-white flex flex-col items-center py-3">
        <button
          onClick={onToggle}
          title="AI 어시스턴트 열기"
          className="w-8 h-8 rounded bg-[#deebff] text-[#0052cc] flex items-center justify-center hover:bg-[#b3d4ff]"
        >
          ✨
        </button>
        <div
          className="mt-3 text-[11px] text-[#6b778c] font-semibold tracking-wider"
          style={{ writingMode: "vertical-rl" }}
        >
          AI 어시스턴트
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[360px] shrink-0 border-l border-[#dfe1e6] bg-white h-full flex flex-col">
      <header className="px-4 py-3 border-b border-[#dfe1e6] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#deebff] text-[#0052cc] flex items-center justify-center">
            ✨
          </div>
          <div>
            <div className="font-semibold text-[#172b4d] text-sm">
              AI 어시스턴트
            </div>
            <div className="text-[11px] text-[#6b778c]">
              저장된 페이지를 참조해 답변합니다
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          title="접기"
          className="w-7 h-7 rounded hover:bg-[#ebecf0] text-[#6b778c]"
        >
          ›
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-sm text-[#6b778c]">
            예: &quot;아키텍처가 어떻게 되어 있어?&quot;
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm ${
              m.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block px-3 py-2 rounded-lg whitespace-pre-wrap max-w-[85%] ${
                m.role === "user"
                  ? "bg-[#0052cc] text-white"
                  : "bg-[#f4f5f7] text-[#172b4d]"
              }`}
            >
              {m.text}
            </div>
            {m.sources && m.sources.length > 0 && (
              <div className="mt-2 text-xs text-[#6b778c]">
                <div className="font-semibold mb-1">근거 페이지</div>
                <ul className="space-y-0.5">
                  {m.sources.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => onOpenPage(s.id)}
                        className="text-[#0052cc] hover:underline"
                      >
                        📄 {s.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-xs text-[#6b778c]">Claude가 답변 중...</div>
        )}
      </div>

      <div className="p-3 border-t border-[#dfe1e6]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="질문을 입력하세요..."
            className="flex-1 px-3 py-2 text-sm border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
          <button
            onClick={ask}
            disabled={loading}
            className="px-3 py-2 text-sm rounded bg-[#0052cc] hover:bg-[#0747a6] text-white disabled:opacity-50"
          >
            전송
          </button>
        </div>
      </div>
    </aside>
  );
}
