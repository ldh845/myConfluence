"use client";

import { useCallback, useEffect, useState } from "react";
import DiagramCard, { type DiagramSummary } from "./DiagramCard";
import DiagramEditorModal from "./DiagramEditorModal";

type Diagram = DiagramSummary & { data: string };

export default function DiagramList({
  pageId,
  editable,
}: {
  pageId: string;
  editable: boolean;
}) {
  const [items, setItems] = useState<Diagram[]>([]);
  const [editing, setEditing] = useState<Diagram | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/diagrams`);
      if (res.ok) {
        const data = (await res.json()) as Diagram[];
        setItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    const res = await fetch(`/api/pages/${pageId}/diagrams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "새 다이어그램" }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as Diagram;
    setItems((prev) => [...prev, created]);
    setEditing(created);
  };

  const handleOpen = async (d: Diagram) => {
    // Fetch fresh state in case another user updated it since the list loaded.
    const res = await fetch(`/api/diagrams/${d.id}`);
    if (res.ok) {
      const full = (await res.json()) as Diagram;
      setEditing(full);
    } else {
      setEditing(d);
    }
  };

  const handleSave = async (patch: {
    data: string;
    title?: string;
    preview?: string | null;
  }) => {
    if (!editing) return;
    const res = await fetch(`/api/diagrams/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = (await res.json()) as Diagram;
      setEditing(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
  };

  const handleDelete = async (d: Diagram) => {
    if (!confirm(`"${d.title}" 다이어그램을 삭제할까요?`)) return;
    const res = await fetch(`/api/diagrams/${d.id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== d.id));
  };

  return (
    <section className="mt-10 pt-6 border-t border-[#dfe1e6]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#172b4d] flex items-center gap-1.5">
          <span>📐</span> 다이어그램
          {items.length > 0 && (
            <span className="text-[#6b778c] font-normal">({items.length})</span>
          )}
        </h3>
        {editable && (
          <button
            onClick={handleCreate}
            className="text-xs text-[#0052cc] hover:underline"
          >
            + 다이어그램 추가
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-[#6b778c] py-4">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-[#6b778c] py-4">
          {editable
            ? '이 페이지에 다이어그램이 없습니다. "+ 다이어그램 추가"로 만들어보세요.'
            : "이 페이지에 다이어그램이 없습니다. 편집 모드에서 새로 추가할 수 있습니다."}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {items.map((d) => (
            <DiagramCard
              key={d.id}
              diagram={d}
              canDelete={editable}
              onOpen={() => handleOpen(d)}
              onDelete={() => handleDelete(d)}
            />
          ))}
        </div>
      )}

      {editing && (
        <DiagramEditorModal
          diagramId={editing.id}
          initialData={editing.data}
          initialTitle={editing.title}
          onSave={handleSave}
          onClose={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}
