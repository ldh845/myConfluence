"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Excalidraw,
  exportToSvg,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";

type Props = {
  initialDataJson: string;
  initialTitle: string;
  onSave: (patch: {
    data: string;
    preview?: string | null;
    title?: string;
  }) => Promise<void> | void;
  onClose: () => void;
};

type SceneSnapshot = {
  elements: readonly ExcalidrawElement[];
  appState: ExcalidrawInitialDataState["appState"];
  files: ExcalidrawInitialDataState["files"];
};

function parseInitial(json: string): ExcalidrawInitialDataState {
  try {
    const obj = JSON.parse(json);
    return {
      elements: obj.elements ?? [],
      appState: {
        ...(obj.appState ?? {}),
        // runtime-only flags we should not restore
        collaborators: new Map(),
      },
      files: obj.files ?? {},
    };
  } catch {
    return { elements: [], appState: {}, files: {} };
  }
}

export default function ExcalidrawEditor({
  initialDataJson,
  initialTitle,
  onSave,
  onClose,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const sceneRef = useRef<SceneSnapshot>({
    elements: [],
    appState: {},
    files: {},
  });

  const initialData = parseInitial(initialDataJson);

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: ExcalidrawInitialDataState["appState"],
      files: ExcalidrawInitialDataState["files"]
    ) => {
      sceneRef.current = { elements, appState, files };
      if (!dirty) setDirty(true);
    },
    [dirty]
  );

  const generatePreview = async (
    snap: SceneSnapshot
  ): Promise<string | null> => {
    try {
      const svg = await exportToSvg({
        elements: snap.elements,
        appState: {
          ...(snap.appState ?? {}),
          exportBackground: true,
          exportWithDarkMode: false,
        },
        files: snap.files ?? null,
      });
      const xml = new XMLSerializer().serializeToString(svg);
      return `data:image/svg+xml;utf8,${encodeURIComponent(xml)}`;
    } catch {
      return null;
    }
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const snap = sceneRef.current;
      const json = serializeAsJSON(
        snap.elements as ExcalidrawElement[],
        snap.appState ?? {},
        snap.files ?? {},
        "local"
      );
      const preview =
        (snap.elements?.length ?? 0) > 0 ? await generatePreview(snap) : null;
      await onSave({ data: json, preview, title });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (dirty) {
      if (!confirm("저장하지 않은 변경사항이 있습니다. 그래도 닫을까요?"))
        return;
    }
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-[#dfe1e6]">
        <span className="text-lg">📐</span>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          placeholder="다이어그램 제목"
          className="flex-1 text-sm font-semibold text-[#172b4d] bg-transparent outline-none border-b border-transparent focus:border-[#0052cc] py-1"
        />
        {saving && (
          <span className="text-[11px] text-[#6b778c]">저장 중...</span>
        )}
        {!saving && dirty && (
          <span className="text-[11px] text-[#de350b]">변경됨</span>
        )}
        {!saving && !dirty && (
          <span className="text-[11px] text-[#006644]">변경 없음</span>
        )}
        <button
          onClick={doSave}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:opacity-50"
        >
          저장
        </button>
        <button
          onClick={requestClose}
          className="text-xs px-3 py-1.5 rounded bg-white border border-[#dfe1e6] hover:bg-[#ebecf0] text-[#172b4d]"
        >
          닫기
        </button>
      </div>
      <div className="flex-1 bg-white">
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          initialData={initialData}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
