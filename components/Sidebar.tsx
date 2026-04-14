"use client";

import { useState } from "react";
import type { PageNode, SpaceWithPages } from "@/lib/types";

type Props = {
  space: SpaceWithPages | null;
  selectedPageId: string | null;
  onSelect: (pageId: string) => void;
  onCreatePage: (spaceId: string, parentId: string | null) => void;
  onDeletePage: (pageId: string) => void;
};

type TreeItem = PageNode & { children: TreeItem[] };

function buildTree(pages: PageNode[]): TreeItem[] {
  const byId = new Map<string, TreeItem>();
  pages.forEach((p) => byId.set(p.id, { ...p, children: [] }));
  const roots: TreeItem[] = [];
  byId.forEach((p) => {
    if (p.parentId && byId.has(p.parentId)) {
      byId.get(p.parentId)!.children.push(p);
    } else {
      roots.push(p);
    }
  });
  return roots;
}

function NavItem({
  icon,
  label,
  active,
  disabled,
}: {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm text-left ${
        active
          ? "bg-[#deebff] text-[#0052cc] font-semibold"
          : disabled
          ? "text-[#a5adba] cursor-not-allowed"
          : "text-[#172b4d] hover:bg-[#ebecf0]"
      }`}
    >
      <span className="w-4 text-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TreeNode({
  node,
  depth,
  selectedPageId,
  onSelect,
  onCreatePage,
  onDeletePage,
}: {
  node: TreeItem;
  depth: number;
  selectedPageId: string | null;
  onSelect: (id: string) => void;
  onCreatePage: (spaceId: string, parentId: string | null) => void;
  onDeletePage: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const selected = selectedPageId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 pr-2 py-1 rounded cursor-pointer text-sm ${
          selected
            ? "bg-[#deebff] text-[#0052cc] font-semibold"
            : "text-[#172b4d] hover:bg-[#ebecf0]"
        }`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onSelect(node.id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          className="w-4 text-[#6b778c] text-xs flex items-center justify-center"
          aria-label="toggle"
        >
          {hasChildren ? (open ? "▾" : "▸") : ""}
        </button>
        <span className="w-4 text-center text-[13px]">📄</span>
        <span className="flex-1 truncate">{node.title}</span>
        <button
          title="하위 페이지 추가"
          className="opacity-0 group-hover:opacity-100 text-[#6b778c] hover:text-[#0052cc] px-1"
          onClick={(e) => {
            e.stopPropagation();
            onCreatePage(node.spaceId, node.id);
          }}
        >
          ＋
        </button>
        <button
          title="삭제"
          className="opacity-0 group-hover:opacity-100 text-[#6b778c] hover:text-[#de350b] px-1"
          onClick={(e) => {
            e.stopPropagation();
            if (
              confirm(
                `"${node.title}" 페이지를 삭제할까요? 하위 페이지도 함께 삭제됩니다.`
              )
            )
              onDeletePage(node.id);
          }}
        >
          ×
        </button>
      </div>
      {open &&
        node.children.map((c) => (
          <TreeNode
            key={c.id}
            node={c}
            depth={depth + 1}
            selectedPageId={selectedPageId}
            onSelect={onSelect}
            onCreatePage={onCreatePage}
            onDeletePage={onDeletePage}
          />
        ))}
    </div>
  );
}

export default function Sidebar({
  space,
  selectedPageId,
  onSelect,
  onCreatePage,
  onDeletePage,
}: Props) {
  const tree = space ? buildTree(space.pages) : [];

  return (
    <aside className="w-[260px] shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] h-full overflow-y-auto flex flex-col">
      {space && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#dfe1e6]">
          <div className="w-8 h-8 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold">
            {space.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[#172b4d] truncate">
              {space.name}
            </div>
            <div className="text-[11px] text-[#6b778c] truncate">
              {space.description ?? "공간"}
            </div>
          </div>
          <button
            title="즐겨찾기"
            className="text-[#6b778c] hover:text-[#ffab00]"
          >
            ☆
          </button>
        </div>
      )}

      <div className="px-2 py-2 space-y-0.5">
        <NavItem icon="📄" label="페이지" active />
        <NavItem icon="📝" label="블로그" disabled />
        <NavItem icon="📅" label="캘린더" disabled />
        <NavItem icon="📊" label="분석" disabled />
      </div>

      <div className="border-t border-[#dfe1e6] mx-2" />

      <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
        공간 바로가기
      </div>
      <div className="px-2 pb-1 text-[12px] text-[#6b778c]">
        <div className="px-3 py-1">빠른 링크가 없습니다</div>
      </div>

      <div className="border-t border-[#dfe1e6] mx-2 my-1" />

      <div className="px-4 pt-2 pb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
          페이지 트리
        </span>
        {space && (
          <button
            className="text-[11px] text-[#0052cc] hover:underline"
            onClick={() => onCreatePage(space.id, null)}
          >
            ＋ 새 페이지
          </button>
        )}
      </div>
      <div className="px-2 pb-4 flex-1">
        {tree.length === 0 && (
          <div className="text-xs text-[#6b778c] px-3 py-2">
            페이지가 없습니다.
          </div>
        )}
        {tree.map((n) => (
          <TreeNode
            key={n.id}
            node={n}
            depth={0}
            selectedPageId={selectedPageId}
            onSelect={onSelect}
            onCreatePage={onCreatePage}
            onDeletePage={onDeletePage}
          />
        ))}
      </div>

      <div className="border-t border-[#dfe1e6] px-4 py-2">
        <button className="flex items-center gap-2 text-sm text-[#172b4d] hover:text-[#0052cc]">
          <span>⚙️</span> 공간 도구
        </button>
      </div>
    </aside>
  );
}
