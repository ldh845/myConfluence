"use client";

export type DiagramSummary = {
  id: string;
  title: string;
  preview: string | null;
  updatedAt: string;
};

type Props = {
  diagram: DiagramSummary;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
};

function formatShort(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function DiagramCard({
  diagram,
  canDelete,
  onOpen,
  onDelete,
}: Props) {
  return (
    <div
      onClick={onOpen}
      className="group relative bg-white border border-[#dfe1e6] rounded cursor-pointer overflow-hidden hover:border-[#0052cc] hover:shadow-sm transition"
    >
      <div className="aspect-[4/3] bg-[#f4f5f7] flex items-center justify-center overflow-hidden">
        {diagram.preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={diagram.preview}
            alt={diagram.title}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-4xl opacity-60">📐</span>
        )}
      </div>
      <div className="px-3 py-2 border-t border-[#dfe1e6]">
        <div className="text-sm font-semibold text-[#172b4d] truncate">
          {diagram.title}
        </div>
        <div className="text-[11px] text-[#6b778c]">
          {formatShort(diagram.updatedAt)}
        </div>
      </div>
      {canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="다이어그램 삭제"
          className="absolute top-1 right-1 w-6 h-6 rounded bg-white/95 border border-[#dfe1e6] text-[#6b778c] hover:text-[#de350b] opacity-0 group-hover:opacity-100 text-sm leading-none"
        >
          ×
        </button>
      )}
    </div>
  );
}
