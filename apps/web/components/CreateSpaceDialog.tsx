"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SpaceWithPages } from "@/lib/types";

// Cycle 80 — '공간 만들기' 모달. 기존 prompt 체인 대체.
//   필드: 공간 이름(필수) / 스페이스 키(선택, 영문·숫자 → 대문자) / 공간 설명(선택).
//   키는 이름에서 자동 제안하되 사용자가 수정하면 그대로 둔다.

function deriveKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

export default function CreateSpaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (space: SpaceWithPages) => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // 열릴 때마다 초기화.
  useEffect(() => {
    if (open) {
      setName("");
      setKey("");
      setKeyTouched(false);
      setDescription("");
      setSaving(false);
    }
  }, [open]);

  const onNameChange = (v: string) => {
    setName(v);
    if (!keyTouched) setKey(deriveKey(v));
  };

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify({
          name: trimmedName,
          ...(key.trim() ? { key: key.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        }),
      });
      if (!r.ok) {
        if (r.status === 400) {
          const b = (await r.json().catch(() => ({}))) as { error?: string };
          window.alert(
            b?.error === "space key already in use"
              ? "이미 사용 중인 스페이스 키입니다."
              : "입력값을 확인해 주세요.",
          );
        } else if (r.status === 401) {
          window.alert("로그인이 필요합니다.");
        } else {
          window.alert("공간 생성에 실패했습니다.");
        }
        return;
      }
      const space = (await r.json()) as SpaceWithPages;
      onOpenChange(false);
      onCreated?.(space);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>공간 만들기</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-semibold text-[#42526e] mb-1">
              공간 이름
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="예: 엔지니어링"
              className="w-full px-2 py-1.5 text-[14px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#42526e] mb-1">
              스페이스 키
            </label>
            <input
              value={key}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 20),
                );
              }}
              placeholder="예: ENG (영문·숫자, 선택)"
              className="w-full px-2 py-1.5 text-[14px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
            />
            <p className="text-[11px] text-[#6b778c] mt-1">
              공간을 식별하는 짧은 키입니다. 비워두면 키 없이 생성됩니다.
            </p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#42526e] mb-1">
              공간 설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="이 공간의 용도를 설명하세요. (선택)"
              className="w-full px-2 py-1.5 text-[14px] border border-[#dfe1e6] rounded resize-y focus:outline-none focus:border-[#0052cc]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="px-3 py-1.5 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#ebecf0]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !name.trim()}
            className="px-3 py-1.5 text-[12px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
          >
            {saving ? "생성 중..." : "만들기"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
