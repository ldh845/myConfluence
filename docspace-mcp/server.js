/**
 * DocSpace MCP Server — Streamable HTTP Transport
 *
 * 사내 AI가 ip:host 로 등록해 DocSpace 문서를 검색·조회·생성·수정·삭제하는 MCP 서버.
 * 의존성: Node.js 내장 모듈만 사용 (http, url, buffer, os, fs, path).
 *
 * 환경변수 (.env 파일 또는 환경변수):
 *   DOCSPACE_TOKEN  — Bearer 토큰 (필수)
 *   DOCSPACE_BASE   — API 베이스 URL (기본 http://166.79.31.248:8082/api)
 *   DOCSPACE_WEB_URL — 웹 UI 베이스 URL (기본: DOCSPACE_BASE 에서 /api 제거)
 *   PORT            — 리슨 포트 (기본 8765)
 */

import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// ─── .env 파일 로딩 (.env 값이 항상 우선, 환경변수 덮어씀) ──
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
}

// ─── 설정 ─────────────────────────────────────────────
const DOCSPACE_TOKEN = process.env.DOCSPACE_TOKEN || "";
const DOCSPACE_BASE =
  process.env.DOCSPACE_BASE || "http://166.79.31.248:8082/api";
const DOCSPACE_WEB_URL =
  process.env.DOCSPACE_WEB_URL || DOCSPACE_BASE.replace(/\/api\/?$/, "");
const PORT = parseInt(process.env.DOCSPACE_PORT || process.env.PORT || "8765", 10);

// ─── DocSpace 웹 URL 생성 헬퍼 ────────────────────────
function pageWebUrl(pageId) {
  return `${DOCSPACE_WEB_URL}/?pageId=${pageId}`;
}

// ─── DocSpace API 호출 헬퍼 ──────────────────────────
async function docspaceFetch(apiPath, { method = "GET", query, body } = {}) {
  const url = new URL(apiPath, DOCSPACE_BASE.endsWith("/") ? DOCSPACE_BASE : DOCSPACE_BASE + "/");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    }
  }

  const headers = {
    Authorization: `Bearer ${DOCSPACE_TOKEN}`,
    Accept: "application/json",
  };
  let bodyStr = undefined;
  if (body) {
    bodyStr = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers,
        timeout: 15_000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const resBody = Buffer.concat(chunks).toString("utf-8");
          resolve({ status: res.statusCode, body: resBody, headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("DocSpace API 접속 시간 초과"));
    });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── ProseMirror JSON → 평문 변환 ────────────────────
function proseMirrorToText(node) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(proseMirrorToText).join("");
  }
  if (Array.isArray(node)) {
    return node.map(proseMirrorToText).join("");
  }
  const childText = node.content ? proseMirrorToText(node.content) : "";
  const blockTypes = new Set([
    "paragraph", "heading", "bullet_list", "ordered_list",
    "list_item", "blockquote", "code_block", "pre",
  ]);
  if (blockTypes.has(node.type)) {
    return childText + "\n";
  }
  return childText;
}

// ─── 에러 메시지 매핑 ─────────────────────────────────
function humanError(status, context = "") {
  const ctx = context ? ` (${context})` : "";
  switch (status) {
    case 301:
    case 302:
    case 307:
    case 308:
      return `인증 실패 — DocSpace 가 로그인으로 리다이렉트합니다. DOCSPACE_TOKEN 이 설정되지 않았거나 만료되었습니다.${ctx}`;
    case 401:
      return `인증 실패 — DOCSPACE_TOKEN 이 유효하지 않거나 만료되었습니다.${ctx}`;
    case 403:
      return `권한 없음 — 해당 리소스에 대한 접근 권한이 없습니다.${ctx}`;
    case 404:
      return `없는 리소스 — 요청한 ${context || "페이지"}를 찾을 수 없습니다.`;
    default:
      return `DocSpace API 오류 (HTTP ${status})${ctx}`;
  }
}

// ─── MCP 도구 구현 ────────────────────────────────────

async function docspaceSearch(args) {
  const query = args?.query;
  if (!query || typeof query !== "string" || !query.trim()) {
    return {
      content: [{ type: "text", text: "검색어(query)를 입력해 주세요." }],
      isError: true,
    };
  }

  const limit = args?.limit || "20";
  const spaceId = args?.spaceId || "";
  const useFullSearch = !!spaceId;
  const apiPath = useFullSearch ? "pages/full-search" : "pages/search";
  const queryParams = useFullSearch
    ? { q: query, limit, spaceId }
    : { q: query };

  let res;
  try {
    res = await docspaceFetch(apiPath, { query: queryParams });
  } catch (e) {
    return {
      content: [
        {
          type: "text",
          text: `DocSpace 서버에 연결할 수 없습니다: ${e.message}\nDOCSPACE_BASE=${DOCSPACE_BASE}`,
        },
      ],
      isError: true,
    };
  }

  if ([301, 302, 307, 308, 401, 403, 404].includes(res.status)) {
    return {
      content: [{ type: "text", text: humanError(res.status, "검색") }],
      isError: true,
    };
  }
  if (res.status !== 200) {
    return {
      content: [
        { type: "text", text: humanError(res.status, `검색: ${res.body.slice(0, 200)}`) },
      ],
      isError: true,
    };
  }

  let data;
  try {
    data = JSON.parse(res.body);
  } catch {
    return {
      content: [{ type: "text", text: `검색 응답 파싱 오류: ${res.body.slice(0, 300)}` }],
      isError: true,
    };
  }

  const items = Array.isArray(data) ? data : data.items || data.results || data.data || [];
  if (items.length === 0) {
    return {
      content: [{ type: "text", text: `"${query}" 검색 결과가 없습니다.` }],
    };
  }

  const lines = items.slice(0, 20).map((p, i) => {
    const id = p.id || p._id || p.pageId || "?";
    const title = p.title || p.name || "(제목 없음)";
    const summary = p.summary || p.excerpt || p.contentPreview || "";
    const space = p.spaceName || p.space?.name || "";
    const webUrl = id !== "?" ? pageWebUrl(id) : "";
    const line = `[${i + 1}] id=${id}  ${title}`;
    const extra = [];
    if (space) extra.push(`공간: ${space}`);
    if (summary) extra.push(summary.slice(0, 120));
    if (webUrl) extra.push(`🔗 ${webUrl}`);
    return extra.length ? `${line}\n     ${extra.join(" | ")}` : line;
  });

  return {
    content: [
      {
        type: "text",
        text: `🔍 "${query}" 검색 결과 (${items.length}건)\n${"─".repeat(50)}\n${lines.join("\n")}`,
      },
    ],
  };
}

async function docspaceReadPage(args) {
  const pageId = args?.pageId;
  if (!pageId) {
    return {
      content: [{ type: "text", text: "pageId를 입력해 주세요." }],
      isError: true,
    };
  }

  let res;
  try {
    res = await docspaceFetch(`pages/${encodeURIComponent(pageId)}`);
  } catch (e) {
    return {
      content: [
        {
          type: "text",
          text: `DocSpace 서버에 연결할 수 없습니다: ${e.message}`,
        },
      ],
      isError: true,
    };
  }

  if ([301, 302, 307, 308, 401, 403, 404].includes(res.status)) {
    return {
      content: [{ type: "text", text: humanError(res.status, `페이지 ${pageId}`) }],
      isError: true,
    };
  }
  if (res.status !== 200) {
    return {
      content: [
        { type: "text", text: humanError(res.status, `페이지 조회: ${res.body.slice(0, 200)}`) },
      ],
      isError: true,
    };
  }

  let page;
  try {
    page = JSON.parse(res.body);
  } catch {
    return {
      content: [{ type: "text", text: `페이지 응답 파싱 오류: ${res.body.slice(0, 300)}` }],
      isError: true,
    };
  }

  let contentText = "";
  if (page.content) {
    if (typeof page.content === "string") {
      try {
        const parsed = JSON.parse(page.content);
        contentText = proseMirrorToText(parsed);
      } catch {
        contentText = page.content;
      }
    } else if (typeof page.content === "object") {
      contentText = proseMirrorToText(page.content);
    }
  }

  const title = page.title || page.name || "(제목 없음)";
  const id = page.id || pageId;
  const space = page.spaceName || page.space?.name || "";
  const author = page.authorName || page.author?.name || page.createdBy || "";
  const updatedAt = page.updatedAt || page.lastModifiedAt || "";
  const status = page.status || "";
  const webUrl = pageWebUrl(id);

  const header = [
    `📄 ${title}`,
    `   ID: ${id}`,
    space ? `   공간: ${space}` : null,
    author ? `   작성자: ${author}` : null,
    updatedAt ? `   수정일: ${updatedAt}` : null,
    status ? `   상태: ${status}` : null,
    `   🔗 ${webUrl}`,
    "─".repeat(50),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    content: [
      {
        type: "text",
        text: contentText ? `${header}\n${contentText}` : `${header}\n(본문 없음)`,
      },
    ],
  };
}

// ─── 쓰기 도구: 페이지 생성 ────────────────────────────
async function docspaceCreatePage(args) {
  const title = args?.title;
  const spaceId = args?.spaceId;
  if (!title || !spaceId) {
    return {
      content: [{ type: "text", text: "title과 spaceId는 필수입니다." }],
      isError: true,
    };
  }

  const body = { title, spaceId };
  if (args?.content) {
    // content가 문자열이면 그대로, 객체면 JSON 문자열로 변환
    body.content = typeof args.content === "string" ? args.content : JSON.stringify(args.content);
  }
  if (args?.parentId) body.parentId = args.parentId;

  let res;
  try {
    res = await docspaceFetch("pages", { method: "POST", body });
  } catch (e) {
    return {
      content: [{ type: "text", text: `DocSpace 서버에 연결할 수 없습니다: ${e.message}` }],
      isError: true,
    };
  }

  if ([301, 302, 307, 308, 401, 403, 404].includes(res.status)) {
    return {
      content: [{ type: "text", text: humanError(res.status, "페이지 생성") }],
      isError: true,
    };
  }
  if (res.status !== 200 && res.status !== 201) {
    return {
      content: [{ type: "text", text: humanError(res.status, `페이지 생성: ${res.body.slice(0, 300)}`) }],
      isError: true,
    };
  }

  let page;
  try {
    page = JSON.parse(res.body);
  } catch {
    return {
      content: [{ type: "text", text: `페이지 생성 응답 파싱 오류: ${res.body.slice(0, 300)}` }],
      isError: true,
    };
  }

  const id = page.id || page._id || "?";
  const webUrl = pageWebUrl(id);

  return {
    content: [
      {
        type: "text",
        text: `✅ 페이지 생성 완료\n   제목: ${title}\n   ID: ${id}\n   🔗 ${webUrl}`,
      },
    ],
  };
}

// ─── 쓰기 도구: 페이지 수정 ────────────────────────────
async function docspaceUpdatePage(args) {
  const pageId = args?.pageId;
  if (!pageId) {
    return {
      content: [{ type: "text", text: "pageId는 필수입니다." }],
      isError: true,
    };
  }

  const body = {};
  if (args?.title !== undefined) body.title = args.title;
  if (args?.content !== undefined) {
    body.content = typeof args.content === "string" ? args.content : JSON.stringify(args.content);
  }
  if (args?.spaceId !== undefined) body.spaceId = args.spaceId;

  if (Object.keys(body).length === 0) {
    return {
      content: [{ type: "text", text: "수정할 필드(title, content, spaceId) 중 최소 하나를 입력해 주세요." }],
      isError: true,
    };
  }

  let res;
  try {
    res = await docspaceFetch(`pages/${encodeURIComponent(pageId)}`, { method: "PATCH", body });
  } catch (e) {
    return {
      content: [{ type: "text", text: `DocSpace 서버에 연결할 수 없습니다: ${e.message}` }],
      isError: true,
    };
  }

  if ([301, 302, 307, 308, 401, 403, 404].includes(res.status)) {
    return {
      content: [{ type: "text", text: humanError(res.status, `페이지 수정 ${pageId}`) }],
      isError: true,
    };
  }
  if (res.status !== 200) {
    return {
      content: [{ type: "text", text: humanError(res.status, `페이지 수정: ${res.body.slice(0, 300)}`) }],
      isError: true,
    };
  }

  let page;
  try {
    page = JSON.parse(res.body);
  } catch {
    return {
      content: [{ type: "text", text: `페이지 수정 응답 파싱 오류: ${res.body.slice(0, 300)}` }],
      isError: true,
    };
  }

  const id = page.id || pageId;
  const updatedTitle = page.title || args?.title || "(제목 없음)";
  const webUrl = pageWebUrl(id);

  return {
    content: [
      {
        type: "text",
        text: `✅ 페이지 수정 완료\n   제목: ${updatedTitle}\n   ID: ${id}\n   수정 필드: ${Object.keys(body).join(", ")}\n   🔗 ${webUrl}`,
      },
    ],
  };
}

// ─── 쓰기 도구: 페이지 복사 (JSON 투과) ───────────────
async function docspaceCopyPage(args) {
  const sourceId = args?.sourceId;
  const targetId = args?.targetId;
  if (!sourceId || !targetId) {
    return {
      content: [{ type: "text", text: "sourceId와 targetId는 필수입니다." }],
      isError: true,
    };
  }

  // 1) 원본 페이지 조회 — content를 변환 없이 그대로 확보
  let getRes;
  try {
    getRes = await docspaceFetch(`pages/${encodeURIComponent(sourceId)}`);
  } catch (e) {
    return {
      content: [{ type: "text", text: `원본 페이지 조회 실패: ${e.message}` }],
      isError: true,
    };
  }

  if (getRes.status !== 200) {
    return {
      content: [{ type: "text", text: humanError(getRes.status, `원본 페이지 조회 ${sourceId}`) }],
      isError: true,
    };
  }

  let sourcePage;
  try {
    sourcePage = JSON.parse(getRes.body);
  } catch {
    return {
      content: [{ type: "text", text: `원본 페이지 파싱 오류: ${getRes.body.slice(0, 300)}` }],
      isError: true,
    };
  }

  // content 필드를 그대로 확보 (문자열이든 객체든 변환 없이 전달)
  const rawContent = sourcePage.content;
  if (!rawContent) {
    return {
      content: [{ type: "text", text: `원본 페이지(${sourceId})에 content가 없습니다.` }],
      isError: true,
    };
  }

  // 2) 타겟 페이지에 content 그대로 PATCH — JSON 투과 복사
  const patchBody = { content: rawContent };
  if (args?.title !== undefined) patchBody.title = args.title;

  let patchRes;
  try {
    patchRes = await docspaceFetch(`pages/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      body: patchBody,
    });
  } catch (e) {
    return {
      content: [{ type: "text", text: `타겟 페이지 수정 실패: ${e.message}` }],
      isError: true,
    };
  }

  if (patchRes.status !== 200) {
    return {
      content: [{ type: "text", text: humanError(patchRes.status, `타겟 페이지 수정 ${targetId}: ${patchRes.body.slice(0, 300)}`) }],
      isError: true,
    };
  }

  const webUrl = pageWebUrl(targetId);

  return {
    content: [
      {
        type: "text",
        text: `✅ 페이지 복사 완료 (JSON 투과)\n   원본: ${sourceId}\n   타겟: ${targetId}\n   🔗 ${webUrl}`,
      },
    ],
  };
}

// ─── 쓰기 도구: 페이지 삭제 ────────────────────────────
async function docspaceDeletePage(args) {
  const pageId = args?.pageId;
  if (!pageId) {
    return {
      content: [{ type: "text", text: "pageId는 필수입니다." }],
      isError: true,
    };
  }

  let res;
  try {
    res = await docspaceFetch(`pages/${encodeURIComponent(pageId)}`, { method: "DELETE" });
  } catch (e) {
    return {
      content: [{ type: "text", text: `DocSpace 서버에 연결할 수 없습니다: ${e.message}` }],
      isError: true,
    };
  }

  if ([301, 302, 307, 308, 401, 403, 404].includes(res.status)) {
    return {
      content: [{ type: "text", text: humanError(res.status, `페이지 삭제 ${pageId}`) }],
      isError: true,
    };
  }
  if (res.status !== 200 && res.status !== 204) {
    return {
      content: [{ type: "text", text: humanError(res.status, `페이지 삭제: ${res.body.slice(0, 300)}`) }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `✅ 페이지 삭제 완료\n   ID: ${pageId}`,
      },
    ],
  };
}

// ─── 쓰기 도구: HTML 가져오기 (Confluence 등 외부 HTML → DocSpace) ──
const execFileAsync = promisify(execFile);

async function docspaceImportHtml(args) {
  const pageId = args?.pageId;
  const html = args?.html;
  if (!pageId || !html) {
    return {
      content: [{ type: "text", text: "pageId와 html은 필수입니다." }],
      isError: true,
    };
  }

  // Python 변환 스크립트 경로
  const scriptPath = path.join(__dirname, "html_to_prosemirror.py");

  // Python 스크립트가 없으면 에러
  if (!fs.existsSync(scriptPath)) {
    return {
      content: [{ type: "text", text: `변환 스크립트가 없습니다: ${scriptPath}` }],
      isError: true,
    };
  }

  // HTML → ProseMirror JSON 변환 (Python 호출)
  // 큰 HTML은 stdin으로 전달하기 어려워 임시 파일 방식 사용
  let proseMirrorJson;
  const tmpDir = path.join(__dirname, "_tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpHtmlPath = path.join(tmpDir, `import_${Date.now()}.html`);
  const tmpJsonPath = path.join(tmpDir, `import_${Date.now()}.json`);
  try {
    // 1) HTML을 임시 파일에 저장
    fs.writeFileSync(tmpHtmlPath, html, "utf-8");

    // 2) Python 스크립트 실행: HTML 파일 읽어서 JSON 파일로 출력
    const pythonExe = process.platform === "win32"
      ? "C:\\Program Files\\SEMCo-Work\\_up_\\_up_\\python\\python.exe"
      : "python3";
    const { stdout, stderr } = await execFileAsync(pythonExe, [
      scriptPath,
      tmpHtmlPath,   // 인자: HTML 파일 경로
      tmpJsonPath,   // 인자: 출력 JSON 파일 경로
    ], { timeout: 30_000 });

    if (stderr && stderr.includes("Error")) {
      return {
        content: [{ type: "text", text: `HTML 변환 오류: ${stderr.slice(0, 500)}` }],
        isError: true,
      };
    }

    // 3) JSON 파일 읽기
    if (!fs.existsSync(tmpJsonPath)) {
      return {
        content: [{ type: "text", text: `HTML 변환 결과 파일이 없습니다. stdout: ${stdout.slice(0, 300)}` }],
        isError: true,
      };
    }
    proseMirrorJson = fs.readFileSync(tmpJsonPath, "utf-8").trim();
    if (!proseMirrorJson.startsWith("{")) {
      return {
        content: [{ type: "text", text: `HTML 변환 결과가 JSON이 아닙니다: ${proseMirrorJson.slice(0, 300)}` }],
        isError: true,
      };
    }
  } catch (e) {
    return {
      content: [{ type: "text", text: `Python 변환 스크립트 실행 실패: ${e.message}` }],
      isError: true,
    };
  } finally {
    // 임시 파일 정리
    try { if (fs.existsSync(tmpHtmlPath)) fs.unlinkSync(tmpHtmlPath); } catch {}
    try { if (fs.existsSync(tmpJsonPath)) fs.unlinkSync(tmpJsonPath); } catch {}
  }

  // DocSpace에 업로드
  const patchBody = { content: proseMirrorJson };
  if (args?.title !== undefined) patchBody.title = args.title;

  let res;
  try {
    res = await docspaceFetch(`pages/${encodeURIComponent(pageId)}`, { method: "PATCH", body: patchBody });
  } catch (e) {
    return {
      content: [{ type: "text", text: `DocSpace 서버에 연결할 수 없습니다: ${e.message}` }],
      isError: true,
    };
  }

  if ([301, 302, 307, 308, 401, 403, 404].includes(res.status)) {
    return {
      content: [{ type: "text", text: humanError(res.status, `HTML 가져오기 ${pageId}`) }],
      isError: true,
    };
  }
  if (res.status !== 200) {
    return {
      content: [{ type: "text", text: humanError(res.status, `HTML 가져오기: ${res.body.slice(0, 300)}`) }],
      isError: true,
    };
  }

  let page;
  try {
    page = JSON.parse(res.body);
  } catch {
    return {
      content: [{ type: "text", text: `페이지 수정 응답 파싱 오류: ${res.body.slice(0, 300)}` }],
      isError: true,
    };
  }

  const id = page.id || pageId;
  const updatedTitle = page.title || args?.title || "(제목 없음)";
  const webUrl = pageWebUrl(id);

  return {
    content: [
      {
        type: "text",
        text: `✅ HTML 가져오기 완료\n   제목: ${updatedTitle}\n   ID: ${id}\n   🔗 ${webUrl}`,
      },
    ],
  };
}

// ─── MCP 도구 정의 ────────────────────────────────────
const TOOLS = [
  {
    name: "docspace_search",
    description:
      "DocSpace 위키에서 문서를 검색합니다. 제목+본문 전문 검색. " +
      "spaceId 를 주면 full-search(필터 지원), 생략하면 간단 검색. " +
      "결과에 각 페이지의 웹 URL이 포함됩니다.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "검색어" },
        spaceId: { type: "string", description: "스페이스 ID (선택, 지정 시 full-search 사용)" },
        limit: { type: "string", description: "결과 수 제한 (기본 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "docspace_read_page",
    description:
      "DocSpace 위키에서 특정 페이지를 조회합니다. " +
      "ProseMirror JSON 본문을 평문 텍스트로 변환해 반환합니다. " +
      "결과에 페이지의 웹 URL이 포함됩니다.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "조회할 페이지 ID" },
      },
      required: ["pageId"],
    },
  },
  {
    name: "docspace_create_page",
    description:
      "DocSpace 위키에 새 페이지를 생성합니다. " +
      "content는 ProseMirror JSON 문자열 또는 객체로 전달합니다. " +
      "ProseMirror JSON 주의사항: text:\"\" 빈 텍스트 노드 금지, 표 셀에 colwidth:null 필수, verticalAlign:\"top\" 필수.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "페이지 제목" },
        spaceId: { type: "string", description: "스페이스 ID" },
        content: {
          oneOf: [
            { type: "string", description: "ProseMirror JSON 문자열" },
            { type: "object", description: "ProseMirror JSON 객체" },
          ],
          description: "페이지 본문 (ProseMirror JSON, 선택)",
        },
        parentId: { type: "string", description: "부모 페이지 ID (선택)" },
      },
      required: ["title", "spaceId"],
    },
  },
  {
    name: "docspace_update_page",
    description:
      "DocSpace 위키의 기존 페이지를 수정합니다. " +
      "전달한 필드만 업데이트됩니다. content는 ProseMirror JSON 문자열 또는 객체. " +
      "ProseMirror JSON 주의사항: text:\"\" 빈 텍스트 노드 금지, 표 셀에 colwidth:null 필수, verticalAlign:\"top\" 필수.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "수정할 페이지 ID" },
        title: { type: "string", description: "새 제목 (선택)" },
        content: {
          oneOf: [
            { type: "string", description: "ProseMirror JSON 문자열" },
            { type: "object", description: "ProseMirror JSON 객체" },
          ],
          description: "새 본문 (ProseMirror JSON, 선택)",
        },
        spaceId: { type: "string", description: "이동할 스페이스 ID (선택)" },
      },
      required: ["pageId"],
    },
  },
  {
    name: "docspace_copy_page",
    description:
      "DocSpace 위키에서 원본 페이지의 content(JSON)를 변환 없이 타겟 페이지에 복사합니다. " +
      "JSON 투과 복사이므로 서식 손실이 0%입니다. " +
      "HTML→ProseMirror 변환 과정이 생략되어 빈 텍스트 노드 등의 문제가 발생하지 않습니다.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string", description: "원본 페이지 ID" },
        targetId: { type: "string", description: "타겟 페이지 ID" },
        title: { type: "string", description: "타겟 페이지 새 제목 (선택, 미지정 시 원본 제목 유지)" },
      },
      required: ["sourceId", "targetId"],
    },
  },
  {
    name: "docspace_delete_page",
    description:
      "DocSpace 위키에서 페이지를 삭제합니다. " +
      "⚠️ 삭제 후 복구 불가하므로 주의해서 사용하세요.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "삭제할 페이지 ID" },
      },
      required: ["pageId"],
    },
  },
  {
    name: "docspace_import_html",
    description:
      "외부 HTML(Confluence 등)을 DocSpace 페이지로 가져옵니다. " +
      "HTML을 ProseMirror JSON으로 자동 변환 후 업로드합니다. " +
      "테이블, 리스트, 제목, 굵게/기울임 등 주요 서식을 지원합니다. " +
      "Confluence 특수 매크로(ac:structured-macro, ac:image 등)는 자동 제거됩니다.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "가져올 타겟 페이지 ID" },
        html: { type: "string", description: "가져올 HTML 문자열" },
        title: { type: "string", description: "페이지 새 제목 (선택)" },
      },
      required: ["pageId", "html"],
    },
  },
];

// ─── MCP 프로토콜 핸들러 ──────────────────────────────
const SERVER_INFO = { name: "docspace-mcp", version: "2.1.0" };
const CAPABILITIES = { tools: { listChanged: false } };

async function handleRequest(rpc) {
  const { id, method, params } = rpc;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: CAPABILITIES,
          serverInfo: SERVER_INFO,
        },
      };

    case "notifications/initialized":
      return null;

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };

    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments || {};
      let result;
      if (toolName === "docspace_search") {
        result = await docspaceSearch(args);
      } else if (toolName === "docspace_read_page") {
        result = await docspaceReadPage(args);
      } else if (toolName === "docspace_create_page") {
        result = await docspaceCreatePage(args);
      } else if (toolName === "docspace_update_page") {
        result = await docspaceUpdatePage(args);
      } else if (toolName === "docspace_copy_page") {
        result = await docspaceCopyPage(args);
      } else if (toolName === "docspace_delete_page") {
        result = await docspaceDeletePage(args);
      } else if (toolName === "docspace_import_html") {
        result = await docspaceImportHtml(args);
      } else {
        result = {
          content: [{ type: "text", text: `알 수 없는 도구: ${toolName}` }],
          isError: true,
        };
      }
      return { jsonrpc: "2.0", id, result };
    }

    default:
      return {
        jsonrpc: "2.0", id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// ─── HTTP 서버 (Streamable HTTP Transport) ────────────
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: SERVER_INFO.name, version: SERVER_INFO.version }));
    return;
  }

  if (pathname === "/mcp" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf-8");

    let rpc;
    try {
      rpc = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
      return;
    }

    const isBatch = Array.isArray(rpc);
    const requests = isBatch ? rpc : [rpc];
    const responses = [];
    for (const r of requests) {
      const resp = await handleRequest(r);
      if (resp !== null) responses.push(resp);
    }

    if (responses.length === 0) {
      res.writeHead(202);
      res.end();
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(isBatch ? responses : responses[0]));
    }
    return;
  }

  if (pathname === "/mcp" && req.method === "GET") {
    const accept = req.headers.accept || "";
    if (accept.includes("text/event-stream")) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("event: endpoint\ndata: /mcp\n\n");
      req.on("close", () => {});
      return;
    }
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Accept: text/event-stream required for SSE" }));
    return;
  }

  if (pathname === "/mcp" && req.method === "DELETE") {
    res.writeHead(200);
    res.end();
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Use POST /mcp for MCP requests." }));
});

// ─── 시작 ─────────────────────────────────────────────
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const a of addrs) {
      if (a.family === "IPv4" && !a.internal) {
        ips.push({ name, address: a.address });
      }
    }
  }
  return ips;
}

server.listen(PORT, "0.0.0.0", () => {
  const nets = getNetworkIPs();
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  DocSpace MCP Server v2.0.0                     ║");
  console.log(`║  Listening on 0.0.0.0:${PORT}                       ║`);
  console.log("╚══════════════════════════════════════════════════╝");
  console.log();
  console.log(`  DOCSPACE_BASE     = ${DOCSPACE_BASE}`);
  console.log(`  DOCSPACE_WEB_URL  = ${DOCSPACE_WEB_URL}`);
  console.log(`  DOCSPACE_TOKEN    = ${DOCSPACE_TOKEN ? "✅ 설정됨" : "❌ 없음 — .env 파일 또는 환경변수로 설정하세요"}`);
  console.log();
  console.log("  📖 읽기 도구:");
  console.log("     docspace_search, docspace_read_page");
  console.log("  ✏️  쓰기 도구:");
  console.log("     docspace_create_page, docspace_update_page");
  console.log("     docspace_copy_page, docspace_delete_page\n  📥 가져오기 도구:\n     docspace_import_html");
  console.log();
  console.log(`  MCP 엔드포인트: POST http://<이 PC IP>:${PORT}/mcp`);
  console.log(`  Health check:   GET  http://<이 PC IP>:${PORT}/health`);
  console.log();
  if (nets.length > 0) {
    console.log("  📡 네트워크 인터페이스:");
    for (const n of nets) {
      console.log(`     ${n.name}: http://${n.address}:${PORT}/mcp`);
    }
  }
  console.log();
  console.log("  사내 AI MCP 등록값:");
  console.log(`    host: <이 PC IP>`);
  console.log(`    port: ${PORT}`);
  console.log(`    path: /mcp`);
  console.log();
});