"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";

export type AppLauncherItem = {
  id: string;
  name: string;
  url: string;
  position: number;
};

export default function LauncherMenuButton({ items, isAdmin }: { items: AppLauncherItem[]; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex shrink-0 items-center rounded px-2 py-1 text-[13px] font-semibold hover:bg-[#ebecf0]"
      >
        <Image src="/icons/menu.png" width={20} height={20} alt="응용 프로그램 탐색기" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-12 z-50 w-72 bg-white rounded-md border border-[#dfe1e6] p-2 shadow-[0_8px_24px_rgba(20,30,45,0.12)]"
        >
{items.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-[#6b778c]">
              등록된 바로가기 항목이 없습니다. 관리자가 설정해 주세요.
            </div>
          ) : (
            <div className="p-1 text-[13px]">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  className="flex items-center gap-2 rounded px-3 py-2 hover:bg-[#ebecf0]"
                >
<span className="min-w-0 flex-1 truncate">{item.name}</span>
                </a>
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="mt-1 px-1 pb-1 border-t border-[#dfe1e6] pt-1">
              <Link
                href="/admin?tab=launcher"
                role="menuitem"
                className="block rounded px-3 py-2 font-semibold text-[#0052cc] hover:bg-[#ebecf0]"
                onClick={() => setOpen(false)}
              >
                설정
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}