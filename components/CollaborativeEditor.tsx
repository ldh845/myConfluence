"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";
import EditorToolbar from "./EditorToolbar";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
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
};

const WS_URL =
  (typeof window !== "undefined" &&
    (window as unknown as { __MYCF_WS_URL__?: string }).__MYCF_WS_URL__) ||
  process.env.NEXT_PUBLIC_WS_URL ||
  "ws://localhost:1234";

export default function CollaborativeEditor({
  pageId,
  initialMarkdown,
  editable,
  onSaveStatusChange,
  onPresenceChange,
}: Props) {
  const identity = useMemo<Identity>(() => getIdentity(), []);
  const [instance, setInstance] = useState<{
    ydoc: Y.Doc;
    provider: WebsocketProvider;
  } | null>(null);

  // Create fresh Y.Doc + provider whenever pageId changes
  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(WS_URL, `page-${pageId}`, ydoc, {
      connect: true,
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
            StarterKit.configure({ history: false }),
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
        : [StarterKit.configure({ history: false })],
      editorProps: {
        attributes: {
          class: "cf-article outline-none min-h-[320px]",
        },
      },
    },
    [instance, identity.name, identity.color]
  );

  // Keep editable in sync without recreating the editor
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

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
    const onSync = (isSynced: boolean) => {
      if (isSynced) {
        trySeed();
        provider.off("sync", onSync);
      }
    };
    provider.on("sync", onSync);
    return () => provider.off("sync", onSync);
  }, [editor, instance, pageId, initialMarkdown]);

  // Debounced save: client-side, last-writer-wins
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
          body: JSON.stringify({ content: latestMd }),
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
      timer = setTimeout(flush, 2000);
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
          <EditorContentWithCursorStyles editor={editor} />
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
        .ProseMirror p.is-editor-empty:first-child::before {
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
