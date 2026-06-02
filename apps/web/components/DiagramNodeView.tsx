"use client";

import { useCallback, useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import DiagramEditorModal from "@/components/DiagramEditorModal";

// Cycle 64 — 본문 다이어그램 노드 뷰. diagramId 로 Diagram 엔티티를 로드해
//   preview 를 표시하고, 편집 모드 클릭 시 ExcalidrawEditor 모달을 연다.

type DiagramFull = {
  id: string;
  title: string;
  data: string;
  preview: string | null;
  updatedAt: string;
};

export default function DiagramNodeView({ node, editor }: NodeViewProps) {
  const diagramId = (node.attrs as { diagramId: string | null }).diagramId;
  const editable = editor.isEditable;
  const [diagram, setDiagram] = useState<DiagramFull | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!diagramId) return;
    const r = await fetch(`/api/diagrams/${diagramId}`);
    if (r.ok) setDiagram((await r.json()) as DiagramFull);
  }, [diagramId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async (patch: {
    data: string;
    title?: string;
    preview?: string | null;
  }) => {
    if (!diagramId) return;
    const r = await fetch(`/api/diagrams/${diagramId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    if (r.ok) setDiagram((await r.json()) as DiagramFull);
  };

  return (
    <NodeViewWrapper as="div" className="cf-diagram my-3">
      <div
        onClick={() => {
          if (editable) setEditing(true);
        }}
        className={`border border-[#dfe1e6] rounded overflow-hidden bg-white ${
          editable ? "cursor-pointer hover:border-[#0052cc]" : ""
        }`}
        title={editable ? "클릭하여 편집" : undefined}
      >
        <div className="aspect-[16/9] max-h-[420px] bg-[#f4f5f7] flex items-center justify-center overflow-hidden">
          {diagram?.preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={diagram.preview}
              alt={diagram.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-[13px] text-[#6b778c] flex items-center gap-2">
              <span className="text-2xl">📐</span>
              {diagramId
                ? editable
                  ? "빈 다이어그램 — 클릭하여 편집"
                  : "다이어그램"
                : "다이어그램을 불러올 수 없습니다"}
            </span>
          )}
        </div>
        {diagram?.title && (
          <div className="px-3 py-1.5 border-t border-[#dfe1e6] text-[12px] text-[#172b4d] truncate">
            {diagram.title}
          </div>
        )}
      </div>

      {editing && diagram && (
        <DiagramEditorModal
          diagramId={diagram.id}
          initialData={diagram.data}
          initialTitle={diagram.title}
          onSave={onSave}
          onClose={() => setEditing(false)}
        />
      )}
    </NodeViewWrapper>
  );
}
