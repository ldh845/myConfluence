"use client";

import {
  useEditor,
  EditorContent,
  ReactNodeViewRenderer,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import { CodeBlockExtension } from "@/lib/tiptap/code-block-lowlight";
import {
  SlashCommand,
  slashCommandSuggestion,
} from "@/lib/tiptap/slash-command";
import EditorToolbar from "./EditorToolbar";
import TaskItemNodeView from "./TaskItemNodeView";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEffect, useMemo, useRef, useState } from "react";
import { getIdentity, type Identity } from "@/lib/userIdentity";

export type PresenceUser = {
  clientId: number;
  name: string;
  color: string;
  self: boolean;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  pageId: string;
  initialMarkdown: string;
  editable: boolean;
  onSaveStatusChange?: (status: SaveStatus) => void;
  onPresenceChange?: (users: PresenceUser[]) => void;
  // FR-039 — 부모(page.tsx)가 TOC 등 외부 위젯에서 editor를 참조할 수 있게 노출.
  onEditor?: (editor: Editor | null) => void;
};

function resolveWsUrl(): string {
  // 1) Runtime override (set on window before app bootstraps)
  if (
    typeof window !== "undefined" &&
    (window as unknown as { __MYCF_WS_URL__?: string }).__MYCF_WS_URL__
  ) {
    return (window as unknown as { __MYCF_WS_URL__?: string }).__MYCF_WS_URL__!;
  }
  // 2) Build-time env var (highest priority for fixed domains/ports)
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  // 3) Derive from the hostname the browser used to reach the app,
  //    so LAN peers hitting http://server-ip:3000 get ws://server-ip:1234.
  const wsHost =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  return `ws://${wsHost}:1234`;
}

const WS_URL = resolveWsUrl();

export default function CollaborativeEditor({
  pageId,
  initialMarkdown,
  editable,
  onSaveStatusChange,
  onPresenceChange,
  onEditor,
}: Props) {
  const identity = useMemo<Identity>(() => getIdentity(), []);
  const [instance, setInstance] = useState<{
    ydoc: Y.Doc;
    provider: HocuspocusProvider;
  } | null>(null);

  // Create fresh Y.Doc + provider whenever pageId changes
  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: WS_URL,
      name: `page-${pageId}`,
      document: ydoc,
    });
    setInstance({ ydoc, provider });
    return () => {
      provider.destroy();
      ydoc.destroy();
      setInstance(null);
    };
  }, [pageId]);

  const editor = useEditor(
    {
      editable,
      extensions: instance
        ? [
            // FR-031 — codeBlock은 CodeBlockLowlight로 교체하므로 StarterKit
            // 기본 codeBlock은 비활성. 두 노드가 충돌하면 schema가 깨진다.
            StarterKit.configure({
              history: false,
              codeBlock: false,
              // FR-030 (Cycle 9-2) — H4까지 노출. StarterKit 기본 levels는
              // 1~6이지만 toolbar/슬래시가 H4까지만 보여주는 게 우리 정책.
              heading: { levels: [1, 2, 3, 4] },
            }),
            CodeBlockExtension,
            // FR-030 (Cycle 9-2) — 밑줄 mark.
            Underline,
            // FR-030 부분 — 체크리스트 + 텍스트/배경 색상.
            // TextStyle은 Color mark를 얹기 위한 base; Highlight multicolor로
            // 형광펜 색을 노드별로 다르게 잡는다. TaskItem은 nested 허용.
            TaskList,
            // FR-030 보강 (Cycle 9-1b) — React NodeView로 체크박스를 직접
            // 컨트롤. editor.editable과 무관하게 항상 클릭 가능하고, attr
            // 변경 transaction이 Y.Doc → 다른 클라이언트로 전파된다.
            TaskItem.configure({ nested: true }).extend({
              addNodeView() {
                return ReactNodeViewRenderer(TaskItemNodeView);
              },
            }),
            TextStyle,
            Color.configure({ types: ["textStyle"] }),
            Highlight.configure({ multicolor: true }),
            SlashCommand.configure({ suggestion: slashCommandSuggestion }),
            Link.configure({
              openOnClick: false,
              autolink: true,
              HTMLAttributes: { rel: "noopener noreferrer" },
            }),
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            Markdown.configure({
              html: false,
              tightLists: true,
              transformCopiedText: true,
            }),
            Collaboration.configure({ document: instance.ydoc }),
            CollaborationCursor.configure({
              provider: instance.provider,
              user: { name: identity.name, color: identity.color },
            }),
          ]
        : [StarterKit.configure({
              history: false,
              codeBlock: false,
              // FR-030 (Cycle 9-2) — H4까지 노출. StarterKit 기본 levels는
              // 1~6이지만 toolbar/슬래시가 H4까지만 보여주는 게 우리 정책.
              heading: { levels: [1, 2, 3, 4] },
            })],
      editorProps: {
        attributes: {
          class: "cf-article outline-none min-h-[320px]",
        },
      },
    },
    [instance, identity.name, identity.color]
  );

  // Keep the live editor's editable flag in sync without tearing down
  // the Yjs WebSocket / awareness pipeline.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  // FR-039 — editor 인스턴스를 부모에 노출. cleanup에서 null 통지.
  useEffect(() => {
    onEditor?.(editor ?? null);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  // Seed initial content from DB once, only if the shared doc is empty
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editor || !instance) return;
    if (seededRef.current === pageId) return;

    const { provider, ydoc } = instance;
    const trySeed = () => {
      const frag = ydoc.getXmlFragment("default");
      if (frag.length === 0 && initialMarkdown) {
        editor.commands.setContent(initialMarkdown, false);
      }
      seededRef.current = pageId;
    };

    if (provider.synced) {
      trySeed();
      return;
    }
    // HocuspocusProvider fires "synced" once when the initial sync
    // round-trip with the server completes.
    const onSynced = () => {
      trySeed();
      provider.off("synced", onSynced);
    };
    provider.on("synced", onSynced);
    return () => provider.off("synced", onSynced);
  }, [editor, instance, pageId, initialMarkdown]);

  // Debounced save: client-side, last-writer-wins.
  // FR-038 / Cycle 9-1b — editable 가드를 제거. 조회 모드에서도 TaskItem
  // NodeView가 attr를 바꾸면 update가 발화하므로 PATCH가 트리거되어 체크
  // 상태가 영속화된다. cleanup의 force-flush 동작은 그대로.
  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let latestMd = "";

    const flush = async () => {
      onSaveStatusChange?.("saving");
      try {
        const res = await fetch(`/api/pages/${pageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // FR-060 — 자동 스냅샷 attribution. 인증 전까지는 익명 이름.
          body: JSON.stringify({
            content: latestMd,
            authorName: identity.name,
          }),
        });
        onSaveStatusChange?.(res.ok ? "saved" : "error");
      } catch {
        onSaveStatusChange?.("error");
      }
    };

    const onUpdate = () => {
      const storage = (
        editor.storage as unknown as {
          markdown?: { getMarkdown: () => string };
        }
      ).markdown;
      if (!storage) return;
      latestMd = storage.getMarkdown();
      if (timer) clearTimeout(timer);
      // FR-038 / NFR-A-020 — 5초 간격 자동 저장
      timer = setTimeout(flush, 5000);
    };

    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      if (timer) {
        clearTimeout(timer);
        flush();
      }
    };
  }, [editor, pageId, onSaveStatusChange]);

  // Presence / awareness
  useEffect(() => {
    if (!instance) return;
    const { provider } = instance;
    const emit = () => {
      const entries = Array.from(
        provider.awareness.getStates().entries()
      ) as [number, { user?: { name: string; color: string } }][];
      const users: PresenceUser[] = entries.map(([clientId, state]) => ({
        clientId,
        name: state?.user?.name ?? "익명",
        color: state?.user?.color ?? "#6b778c",
        self: clientId === provider.awareness.clientID,
      }));
      onPresenceChange?.(users);
    };
    provider.awareness.on("change", emit);
    emit();
    return () => provider.awareness.off("change", emit);
  }, [instance, onPresenceChange]);

  return (
    <div className="relative">
      {!editor || !instance ? (
        <div className="text-sm text-[#6b778c]">에디터 불러오는 중...</div>
      ) : (
        <>
          {editable && <EditorToolbar editor={editor} />}
          <div
            className={
              editable
                ? "rounded border-l-2 border-[#0052cc] bg-[#f4f8ff]/40 pl-4 py-2 transition-colors"
                : "pl-4 py-2 transition-colors"
            }
          >
            <EditorContentWithCursorStyles editor={editor} />
          </div>
        </>
      )}
    </div>
  );
}

function EditorContentWithCursorStyles({ editor }: { editor: Editor }) {
  return (
    <>
      <style jsx global>{`
        .ProseMirror {
          min-height: 320px;
          outline: none;
        }
        .ProseMirror[contenteditable="false"] {
          caret-color: transparent;
        }
        .ProseMirror[contenteditable="false"] p.is-editor-empty:first-child::before {
          content: "(내용 없음) — '편집 (E)'을 눌러 작성을 시작하세요.";
          color: #6b778c;
          font-style: italic;
        }
        .ProseMirror[contenteditable="true"] p.is-editor-empty:first-child::before {
          content: "내용을 입력하세요...";
          color: #a5adba;
          float: left;
          height: 0;
          pointer-events: none;
        }
        .collaboration-cursor__caret {
          border-left: 1px solid #0052cc;
          border-right: 1px solid #0052cc;
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
          position: relative;
          word-break: normal;
        }
        .ProseMirror table {
          border-collapse: collapse;
          margin: 0.8em 0;
          overflow: hidden;
          table-layout: fixed;
          width: 100%;
        }
        .ProseMirror table td,
        .ProseMirror table th {
          border: 1px solid #dfe1e6;
          padding: 6px 10px;
          vertical-align: top;
          position: relative;
        }
        .ProseMirror table th {
          background: #f4f5f7;
          font-weight: 600;
        }
        .ProseMirror table .selectedCell:after {
          background: rgba(0, 82, 204, 0.12);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }
        .ProseMirror table .column-resize-handle {
          background: #0052cc;
          bottom: -2px;
          position: absolute;
          right: -2px;
          pointer-events: none;
          top: 0;
          width: 3px;
        }
        .ProseMirror.resize-cursor {
          cursor: col-resize;
        }
        .ProseMirror a {
          color: #0052cc;
          text-decoration: underline;
        }
        .collaboration-cursor__label {
          border-radius: 3px 3px 3px 0;
          color: white;
          font-size: 11px;
          font-style: normal;
          font-weight: 600;
          left: -1px;
          line-height: normal;
          padding: 1px 4px;
          position: absolute;
          top: -14px;
          user-select: none;
          white-space: nowrap;
        }
      `}</style>
      <EditorContent editor={editor} />
    </>
  );
}
