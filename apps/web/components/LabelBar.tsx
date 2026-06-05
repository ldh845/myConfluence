"use client";

import { useEffect, useRef, useState } from "react";
import AppIcon from "@/components/AppIcon";

// Cycle 78 — 페이지 레이블(태그) 바. 칩 표시 + 클릭 팝업에서 추가/제거.
//   PATCH /api/pages/:id { labels } 로 전체 교체(서버가 정규화). 로컬 낙관 갱신.
const MAX_LABELS = 20;
const MAX_LABEL_LEN = 50;

export default function LabelBar({
  pageId,
  labels: initial,
  editable,
}: {
  pageId: string;
  labels: string[];
  editable: boolean;
}) {
  const [labels, setLabels] = useState<string[]>(initial);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 페이지가 바뀌면 서버 값으로 동기화.
  useEffect(() => {
    setLabels(initial);
    setOpen(false);
    setInput("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const save = async (next: string[]) => {
    const prev = labels;
    setLabels(next); // 낙관적
    setSaving(true);
    try {
      const r = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify({ labels: next }),
      });
      if (!r.ok) throw new Error();
      const updated = (await r.json()) as { labels?: string[] };
      if (Array.isArray(updated.labels)) setLabels(updated.labels);
    } catch {
      setLabels(prev); // 롤백
      window.alert("레이블을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const addLabel = () => {
    const v = input.trim().slice(0, MAX_LABEL_LEN);
    setInput("");
    if (!v) return;
    if (labels.some((l) => l.toLowerCase() === v.toLowerCase())) return;
    if (labels.length >= MAX_LABELS) {
      window.alert(`레이블은 최대 ${MAX_LABELS}개까지 추가할 수 있습니다.`);
      return;
    }
    void save([...labels, v]);
  };

  const removeLabel = (label: string) => {
    void save(labels.filter((l) => l !== label));
  };

  return (
    <div ref={ref} className="relative flex flex-wrap items-center gap-1.5">
      {/* Cycle 82 followup — 태그 아이콘 자체가 추가 트리거. 별도 '+ 레이블 추가' 버튼 제거. */}
      {editable ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="레이블 추가"
          className="shrink-0 text-[#6b778c] hover:text-[#0052cc] leading-none"
        >
          <AppIcon name="tag" size={16} alt="레이블" />
        </button>
      ) : (
        <span className="shrink-0 text-[#6b778c] leading-none">
          <AppIcon name="tag" size={16} alt="레이블" />
        </span>
      )}
      {labels.length === 0 && !editable && (
        <span className="text-[13px] text-[#6b778c]">레이블 없음</span>
      )}
      {labels.map((l) => (
        <span
          key={l}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] bg-[#f4f5f7] border border-[#dfe1e6] text-[#42526e]"
        >
          {l}
          {editable && (
            <button
              type="button"
              onClick={() => removeLabel(l)}
              disabled={saving}
              aria-label={`레이블 '${l}' 제거`}
              className="text-[#6b778c] hover:text-[#de350b] leading-none"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-64 bg-white border border-[#dfe1e6] rounded-md shadow-lg p-2">
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLabel();
                }
              }}
              maxLength={MAX_LABEL_LEN}
              placeholder="레이블 입력 후 Enter"
              className="flex-1 min-w-0 px-2 py-1 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
            />
            <button
              type="button"
              onClick={addLabel}
              disabled={saving || !input.trim()}
              className="px-2 py-1 text-[12px] rounded bg-[#0052cc] hover:bg-[#0747a6] disabled:bg-[#a5adba] text-white shrink-0"
            >
              추가
            </button>
          </div>
          {labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {labels.map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] bg-[#f4f5f7] border border-[#dfe1e6] text-[#42526e]"
                >
                  {l}
                  <button
                    type="button"
                    onClick={() => removeLabel(l)}
                    disabled={saving}
                    aria-label={`레이블 '${l}' 제거`}
                    className="text-[#6b778c] hover:text-[#de350b] leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
