"use client";

import dynamic from "next/dynamic";

const ExcalidrawEditor = dynamic(() => import("./ExcalidrawEditor"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center">
      <div className="bg-white rounded px-6 py-4 text-sm text-[#172b4d]">
        Excalidraw 불러오는 중...
      </div>
    </div>
  ),
});

type Props = {
  diagramId: string;
  initialData: string;
  initialTitle: string;
  onSave: (patch: {
    data: string;
    title?: string;
    preview?: string | null;
  }) => Promise<void> | void;
  onClose: () => void;
};

export default function DiagramEditorModal({
  diagramId,
  initialData,
  initialTitle,
  onSave,
  onClose,
}: Props) {
  return (
    <ExcalidrawEditor
      key={diagramId}
      initialDataJson={initialData}
      initialTitle={initialTitle}
      onSave={onSave}
      onClose={onClose}
    />
  );
}
