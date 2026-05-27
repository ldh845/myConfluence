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
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Extension } from "@tiptap/core";
import { CodeBlockExtension } from "@/lib/tiptap/code-block-lowlight";
import { InlineCommentMark } from "@/lib/tiptap/inline-comment-mark";
import { MarkdownInputRules } from "@/lib/tiptap/markdown-input-rules";
import { MathInline } from "@/lib/tiptap/math-inline";
import { MathBlock } from "@/lib/tiptap/math-block";
import { DateExtension } from "@/lib/tiptap/date";
import {
  SlashCommand,
  slashCommandSuggestion,
} from "@/lib/tiptap/slash-command";
import EditorToolbar from "./EditorToolbar";
import TaskItemNodeView from "./TaskItemNodeView";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { EditorView } from "@tiptap/pm/view";
import { getIdentity, type Identity } from "@/lib/userIdentity";

export type PresenceUser = {
  clientId: number;
  name: string;
  color: string;
  self: boolean;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// FR-054 (Cycle 26) — 오프라인 편집 상태.
//  online-synced: 정상 (WS 연결 + 동기화 완료) — 표시 안 함
//  online-syncing: WS 연결됐지만 아직 초기 sync 중
//  offline: 브라우저 또는 WS 끊김 — IndexedDB에 영속, 재연결 대기
//  reconnecting: 네트워크 복귀 시도 중
export type ConnectionState =
  | "online-synced"
  | "online-syncing"
  | "offline"
  | "reconnecting";

type Props = {
  pageId: string;
  initialMarkdown: string;
  editable: boolean;
  onSaveStatusChange?: (status: SaveStatus) => void;
  onPresenceChange?: (users: PresenceUser[]) => void;
  // FR-039 — 부모(page.tsx)가 TOC 등 외부 위젯에서 editor를 참조할 수 있게 노출.
  onEditor?: (editor: Editor | null) => void;
  // FR-054 (Cycle 26) — 연결 상태 변경을 부모에 통지(헤더 뱃지/배너용).
  onConnectionStateChange?: (state: ConnectionState) => void;
  // Cycle 34 — 전체 화면 편집기에서는 툴바를 상단 sticky 영역에 따로 배치한다.
  // true면 내부 EditorToolbar 렌더 생략 — 부모는 onEditor로 받은 인스턴스로
  // 직접 <EditorToolbar editor={editor}/>를 띄운다.
  hideToolbar?: boolean;
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

// Cycle 38 — Confluence식 목록 단축키. StarterKit 기본은 Mod-Shift-7/8 인데,
// Confluence는 Mod-Shift-N(번호) / Mod-Shift-B(단추) 라서 이쪽으로 추가 매핑.
// 둘 다 Tiptap 명령이 true를 반환해 브라우저 기본(즐겨찾기 바, 새 시크릿 창)을
// preventDefault 한다.
const ListShortcuts = Extension.create({
  name: "listShortcuts",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-b": () => this.editor.commands.toggleBulletList(),
      "Mod-Shift-n": () => this.editor.commands.toggleOrderedList(),
    };
  },
});

// Cycle 38 followup — 일반 문단/제목에도 들여쓰기/내어쓰기 적용 가능하도록
// indent 속성을 추가. 한 단계당 24px margin-left, 최대 8단계.
// 리스트 항목은 별도 sink/liftListItem 으로 처리되므로 여기 대상에서 제외.
// 마크다운 직렬화는 indent 속성을 복원하지 않으므로 새로고침 시엔 0으로 리셋
// 되지만, 편집 중 시각적 들여쓰기는 즉시 적용된다.
const INDENT_STEP_PX = 24;
const INDENT_MAX = 8;
const INDENT_TYPES = ["paragraph", "heading"] as const;

const BlockIndent = Extension.create({
  name: "blockIndent",
  addGlobalAttributes() {
    return [
      {
        types: [...INDENT_TYPES],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const ml = parseInt(
                (el as HTMLElement).style.marginLeft || "0",
                10,
              );
              if (!Number.isFinite(ml) || ml <= 0) return 0;
              return Math.min(INDENT_MAX, Math.floor(ml / INDENT_STEP_PX));
            },
            renderHTML: (attrs) => {
              const lvl = (attrs as { indent?: number }).indent ?? 0;
              if (!lvl) return {};
              return { style: `margin-left: ${lvl * INDENT_STEP_PX}px` };
            },
            keepOnSplit: false,
          },
        },
      },
    ];
  },
});

export default function CollaborativeEditor({
  pageId,
  initialMarkdown,
  editable,
  onSaveStatusChange,
  onPresenceChange,
  onEditor,
  onConnectionStateChange,
  hideToolbar,
}: Props) {
  const identity = useMemo<Identity>(() => getIdentity(), []);
  const queryClient = useQueryClient();
  const [instance, setInstance] = useState<{
    ydoc: Y.Doc;
    provider: HocuspocusProvider;
  } | null>(null);

  // FR-054 — onConnectionStateChange를 ref로 보관. WS effect가 콜백 정체성에
  // 의존하면 부모 리렌더마다 provider가 재생성돼 "WebSocket closed before
  // established"가 반복된다. ref로 빼면 effect deps는 [editable, pageId]만.
  const connStateRef = useRef(onConnectionStateChange);
  connStateRef.current = onConnectionStateChange;

  // FR-033 (Cycle 12-1) — 본문 안에 드롭/붙여넣기된 이미지 파일을 첨부 API로
  // 업로드하고 ProseMirror image 노드로 인라인 삽입한다. 첨부 영역(useQuery)
  // 도 invalidate해 카드 목록을 즉시 갱신.
  const uploadImageFiles = useCallback(
    (view: EditorView, files: File[], pos: number) => {
      void (async () => {
        for (const file of files) {
          const form = new FormData();
          form.append("file", file);
          form.append("authorName", identity.name);
          try {
            const r = await fetch(`/api/pages/${pageId}/attachments`, {
              method: "POST",
              body: form,
            });
            if (!r.ok) {
              if (r.status === 413) {
                window.alert("파일이 너무 큽니다 (최대 100MB).");
              } else {
                window.alert("이미지 업로드에 실패했습니다.");
              }
              continue;
            }
            const att = (await r.json()) as { id: string };
            const imageType = view.state.schema.nodes.image;
            if (!imageType) continue;
            const node = imageType.create({
              src: `/api/attachments/${att.id}`,
              alt: file.name,
            });
            view.dispatch(view.state.tr.insert(pos, node));
            queryClient.invalidateQueries({
              queryKey: ["attachments", pageId],
            });
          } catch (err) {
            console.error("[image] upload failed", err);
            window.alert("이미지 업로드에 실패했습니다.");
          }
        }
      })();
    },
    [pageId, identity.name, queryClient],
  );

  // Cycle 10-2b-1 — 편집 모드일 때만 Yjs 세션. 조회 모드 사용자는 다른
  // 사용자의 임시 변경(draft)이 보이지 않게 하기 위해 협업 채널에 참여하지
  // 않는다. page.tsx가 모드 전환 시 key prop으로 컴포넌트를 재마운트한다.
  // FR-054 (Cycle 26) — IndexedDB persistence + 연결 상태 추적.
  useEffect(() => {
    if (!editable) return;
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: WS_URL,
      name: `page-${pageId}`,
      document: ydoc,
    });
    // FR-054 — Y.Doc을 IndexedDB에 영속 → 오프라인에서도 마지막 상태 복원 +
    // 편집 즉시 영속. 재연결 시 Yjs CRDT가 자동 merge.
    const persistence = new IndexeddbPersistence(
      `docspace-page-${pageId}`,
      ydoc,
    );

    // 연결 상태 추적 — provider.status 속성을 직접 읽지 않고 이벤트 페이로드로
    // 추적한다(속성이 버전에 따라 비어있을 수 있음). status 이벤트는
    // { status: 'connecting' | 'connected' | 'disconnected' } 를 준다.
    let wsStatus: "connecting" | "connected" | "disconnected" = "connecting";
    let synced = false;

    const pushState = () => {
      const cb = connStateRef.current;
      if (!cb) return;
      const navOnline =
        typeof navigator === "undefined" ? true : navigator.onLine;
      if (!navOnline) {
        cb("offline");
        return;
      }
      if (wsStatus === "connected") {
        cb(synced ? "online-synced" : "online-syncing");
      } else if (wsStatus === "connecting") {
        cb("reconnecting");
      } else {
        cb("offline");
      }
    };

    const onStatus = (event: { status?: string }) => {
      const s = event?.status;
      if (s === "connecting" || s === "connected" || s === "disconnected") {
        wsStatus = s;
      }
      pushState();
    };
    const onSynced = () => {
      synced = true;
      wsStatus = "connected";
      pushState();
    };
    const onDisconnect = () => {
      wsStatus = "disconnected";
      synced = false;
      pushState();
    };
    const onOnline = () => pushState();
    const onOffline = () => connStateRef.current?.("offline");

    provider.on("status", onStatus);
    provider.on("synced", onSynced);
    provider.on("disconnect", onDisconnect);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    pushState();

    setInstance({ ydoc, provider });
    return () => {
      provider.off("status", onStatus);
      provider.off("synced", onSynced);
      provider.off("disconnect", onDisconnect);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      void persistence.destroy();
      provider.destroy();
      ydoc.destroy();
      setInstance(null);
    };
  }, [editable, pageId]);

  const editor = useEditor(
    {
      editable,
      extensions: [
        // FR-031 — codeBlock은 CodeBlockLowlight로 교체하므로 StarterKit
        // 기본 codeBlock은 비활성. 두 노드가 충돌하면 schema가 깨진다.
        // Cycle 10-2b-1 — 편집 모드는 Yjs UndoManager 사용(history false),
        // 조회 모드는 어차피 편집 불가라 history 켜둬도 무관하지만 일관성을
        // 위해 둘 다 false.
        StarterKit.configure({
          history: false,
          codeBlock: false,
          // Cycle 37 followup — 문단 스타일 드롭다운에 H1~H6 모두 노출하도록
          // 확장 (이전 H4까지 정책에서 변경). 마크다운 #~###### 자동변환도 자연히 동작.
          heading: { levels: [1, 2, 3, 4, 5, 6] },
        }),
        CodeBlockExtension,
        // FR-030 (Cycle 9-2) — 밑줄 mark.
        Underline,
        // Cycle 37 followup — 아래첨자 / 윗첨자 mark (취소선 드롭다운에서 선택).
        Subscript,
        Superscript,
        // Cycle 38 — 텍스트 정렬 (좌/중/우). 적용 대상은 paragraph + heading.
        // (인용/리스트 항목 정렬은 정책상 제외 — Confluence와 동일한 범위.)
        TextAlign.configure({
          types: ["heading", "paragraph"],
          alignments: ["left", "center", "right"],
          defaultAlignment: "left",
        }),
        // Cycle 38 — Ctrl/Cmd+Shift+B (단추형) / Ctrl/Cmd+Shift+N (번호형) 단축키.
        ListShortcuts,
        // Cycle 38 followup — 일반 문단/제목 들여쓰기 속성.
        BlockIndent,
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
        // FR-033 (Cycle 12-1) — 본문 이미지. allowBase64=false로 서버 업로드
        // 강제 (DB 비대화 방지). 외부 URL/크기 조절/캡션은 12-2에서.
        Image.configure({
          inline: false,
          allowBase64: false,
          HTMLAttributes: { class: "cf-image" },
        }),
        // FR-071 (Cycle 16-3b-1) — 인라인 댓글 마크.
        InlineCommentMark,
        // FR-040 (Cycle 20) — LaTeX 수식 (인라인 + 블록).
        MathInline,
        MathBlock,
        // Cycle 54-F — 날짜 inline atom. + / slash 카탈로그에서 진입.
        DateExtension,
        // FR-036 (Cycle 13) — StarterKit 미커버 input rules (체크리스트/링크/이미지).
        MarkdownInputRules,
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
        // Cycle 10-2b-1 — 편집 모드 + Yjs 세션 준비된 후에만 Collaboration.
        ...(editable && instance
          ? [
              Collaboration.configure({ document: instance.ydoc }),
              CollaborationCursor.configure({
                provider: instance.provider,
                user: { name: identity.name, color: identity.color },
              }),
            ]
          : []),
      ],
      // Cycle 10-2b-1 — 조회 모드는 Yjs 없이 published content를 직접 시드.
      // 편집 모드는 Collaboration extension이 ydoc에서 채워주므로 content
      // prop을 주면 안 된다(중복 시드 → 본문 두 번 표시).
      content: !editable ? initialMarkdown : undefined,
      editorProps: {
        attributes: {
          class: "cf-article outline-none min-h-[320px]",
        },
        // FR-033 (Cycle 12-1) — 드래그앤드롭 이미지 파일 → 첨부 업로드 + 인라인 삽입.
        handleDrop: (view, event) => {
          if (!editable) return false;
          const files = event.dataTransfer
            ? Array.from(event.dataTransfer.files)
            : [];
          const images = files.filter((f) => f.type.startsWith("image/"));
          if (images.length === 0) return false;
          event.preventDefault();
          const pos =
            view.posAtCoords({ left: event.clientX, top: event.clientY })
              ?.pos ?? view.state.selection.from;
          uploadImageFiles(view, images, pos);
          return true;
        },
        // FR-033 (Cycle 12-1) — 클립보드(스크린샷 등) 이미지 붙여넣기.
        handlePaste: (view, event) => {
          if (!editable) return false;
          const items = event.clipboardData?.items;
          if (!items) return false;
          const imageItems = Array.from(items).filter(
            (it) => it.kind === "file" && it.type.startsWith("image/"),
          );
          if (imageItems.length === 0) return false;
          const files = imageItems
            .map((it) => it.getAsFile())
            .filter((f): f is File => !!f);
          if (files.length === 0) return false;
          event.preventDefault();
          uploadImageFiles(view, files, view.state.selection.from);
          return true;
        },
      },
    },
    [
      editable,
      instance,
      identity.name,
      identity.color,
      initialMarkdown,
      uploadImageFiles,
    ]
  );

  // FR-039 — editor 인스턴스를 부모에 노출. cleanup에서 null 통지.
  useEffect(() => {
    onEditor?.(editor ?? null);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  // Seed initial content from DB once, only if the shared doc is empty.
  // Cycle 10-2b-1 — 조회 모드는 useEditor의 content prop이 시드를 처리하므로
  // 이 효과는 편집 모드 전용.
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editable) return;
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
    return () => {
      provider.off("synced", onSynced);
    };
  }, [editor, instance, pageId, initialMarkdown, editable]);

  // Debounced save: client-side, last-writer-wins.
  // Cycle 10-2b-1 — editable 가드 복귀. 조회 모드는 Yjs 미참여이고 자동저장도
  // 하지 않는다. 조회 모드 체크박스 토글은 10-2b-2에서 즉시 발행 흐름으로
  // 별도 처리(현재는 일시적으로 영속화되지 않음).
  useEffect(() => {
    if (!editor || !editable) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let latestMd = "";

    const flush = async () => {
      onSaveStatusChange?.("saving");
      try {
        // Cycle 10-2a — 자동저장은 draft로. content는 발행 시점에만 갱신.
        const res = await fetch(`/api/pages/${pageId}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
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
  }, [editor, editable, pageId, onSaveStatusChange]);

  // Presence / awareness
  useEffect(() => {
    if (!instance) return;
    const { provider } = instance;
    const awareness = provider.awareness;
    if (!awareness) return;
    const emit = () => {
      const entries = Array.from(
        awareness.getStates().entries()
      ) as [number, { user?: { name: string; color: string } }][];
      const users: PresenceUser[] = entries.map(([clientId, state]) => ({
        clientId,
        name: state?.user?.name ?? "익명",
        color: state?.user?.color ?? "#6b778c",
        self: clientId === awareness.clientID,
      }));
      onPresenceChange?.(users);
    };
    awareness.on("change", emit);
    emit();
    return () => {
      awareness.off("change", emit);
    };
  }, [instance, onPresenceChange]);

  // Cycle 10-2b-1 — 조회 모드는 Yjs instance 없이도 렌더. 편집 모드는
  // instance가 준비되기 전 잠시 로딩 표시(Yjs sync 시작 전 빈 본문 방지).
  return (
    <div className="relative">
      {!editor || (editable && !instance) ? (
        <div className="text-sm text-[#6b778c]">에디터 불러오는 중...</div>
      ) : (
        <>
          {editable && !hideToolbar && <EditorToolbar editor={editor} />}
          {/* Cycle 37 — Confluence 편집기는 본문에 별도 박스/색을 두지 않는다.
              조회/편집 모드 모두 같은 좌측 라인의 일반 문서 영역. */}
          <div className="py-2">
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
