# DocSpace Cycles

> 모든 개발 사이클의 진행 내역. 사이클당 한 섹션, 시간 순.
> 상태 이모지: ✅ Done, 🔄 In Progress, ⛔ Blocked, ⏭ Skipped, 📝 Planned

총 102개 사이클 커밋(Pre-cycle housekeeping 포함). FR 번호는 SRS 문서 기준.

---

## Pre-cycle — 2026-05-08 — ✅ Done
- **제목**: NestJS scaffold + 인프라 트래킹
- **카테고리**: 운영/스캐폴딩
- **커밋**: `d58fc2e`
- **변경 파일**: `apps/api/` (NestJS 보일러플레이트 전체), `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260507090325_init/`, `docker-compose.yml`
- **검증**: 사이클 2 이전, NestJS 앱이 빌드되고 `apps/api` 디렉터리 구조가 잡힘
- **비고**: 단순 POC(Next.js + SQLite)에서 NestJS + Postgres 모노레포로 전환하기 위한 골격. Cycle 2 시리즈가 이 기반 위에서 마이그레이션 진행.

---

## Cycle 2-1 — 2026-05-08 — ✅ Done
- **제목**: 루트 Prisma를 PostgreSQL로 전환 + 재시드
- **카테고리**: 인프라 / DB 마이그레이션
- **커밋**: `6bf8714`
- **변경 파일**: `.env.example`, `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/20260414071021_init/`, `migration_lock.toml`
- **검증**: SQLite → PostgreSQL 전환 후 seed가 정상 적재. 페이지/스페이스 기본 조회 동작.
- **비고**: SQLite는 풀텍스트 검색·동시 쓰기에서 한계가 명확해서 Cycle 15(pg_trgm) 이전에 미리 전환. 이후 Cycle 2-5에서 Prisma 자체가 apps/api로 이동하므로 이 루트 Prisma는 한 번 더 정리됨.

---

## Cycle 2-2 — 2026-05-08 — ✅ Done
- **제목**: `/api/spaces` → NestJS Spaces 모듈
- **카테고리**: 백엔드 마이그레이션
- **커밋**: `304bbeb`
- **변경 파일**: `app/api/spaces/route.ts` (Next API 제거), `apps/api/src/spaces/` (controller / service / module / DTO), `next.config.mjs` (rewrite 추가)
- **검증**: 기존 Next API의 spaces CRUD 호출이 NestJS 엔드포인트로 투명하게 라우팅. 프런트엔드 호출 코드 변경 없음.
- **비고**: 사이클 2-2/2-3/2-4가 한 묶음 — Next API 라우트를 NestJS로 옮기는 점진 마이그레이션. `next.config.mjs` rewrite로 `/api/*`를 `localhost:4000`으로 프록시.

---

## Cycle 2-3 — 2026-05-08 — ✅ Done
- **제목**: `/api/pages` (+ `/pages/:id/diagrams`) → NestJS Pages 모듈
- **카테고리**: 백엔드 마이그레이션
- **커밋**: `13f478d`
- **변경 파일**: `app/api/pages/**` 제거, `apps/api/src/pages/` 신규 (controller / service / module / DTO 3종), `next.config.mjs` rewrite 보강
- **검증**: 페이지 CRUD + 다이어그램 리스트가 NestJS 라우트로 정상 동작
- **비고**: Page 모델은 이 시점에서 NestJS PrismaService가 단독 소유.

---

## Cycle 2-4 — 2026-05-08 — ✅ Done
- **제목**: `/api/diagrams/:id` → NestJS Diagrams 모듈
- **카테고리**: 백엔드 마이그레이션
- **커밋**: `72df8fd`
- **변경 파일**: `app/api/diagrams/[id]/route.ts` 제거, `apps/api/src/diagrams/` 신규, `next.config.mjs` rewrite
- **검증**: 다이어그램 단건 조회/수정 NestJS로 이동, 프런트는 변경 없음
- **비고**: 2-3과 묶어 다이어그램 관련 모든 엔드포인트가 NestJS로 통합.

---

## Cycle 2-5 — 2026-05-08 — ✅ Done
- **제목**: Next의 API/Prisma 의존성 정리 + seed를 apps/api로 통합
- **카테고리**: 정리 / 모노레포 분리
- **커밋**: `7795bbd`
- **변경 파일**: `app/api/ai/search/route.ts` 제거, `lib/claude.ts`, `lib/prisma.ts` 제거, `prisma/schema.prisma` 제거, `apps/api/prisma/seed.ts`, 루트 `package.json` 의존성 정리
- **검증**: 루트에 Prisma/Claude SDK 의존성 사라짐. `npm run seed`가 apps/api에서 동작.
- **비고**: 챗 패널 사이클(2-5 시점)은 일시 비활성. SRS 5.9 검색·AI 사이클에서 재구현 예정.

---

## Cycle 3 — 2026-05-08 — ✅ Done
- **제목**: y-websocket → NestJS-hosted Hocuspocus + Redis adapter
- **카테고리**: 협업 (FR-050~054)
- **커밋**: `9867fc8`
- **변경 파일**: `apps/api/src/collaboration/collaboration.{module,service}.ts`, `apps/api/src/app.module.ts`, `apps/api/.env.example` (REDIS_HOST/PORT), `server/ws-server.js` 제거, `components/CollaborativeEditor.tsx`
- **검증**: 두 창에서 동시 편집 시 본문 동기화. Hocuspocus가 NestJS 라이프사이클(onModuleInit/Destroy)에 통합되어 단일 프로세스로 운영.
- **비고**: Redis pub/sub 어댑터가 활성화돼 멀티 인스턴스 확장 준비. Cycle 39에서 USE_REDIS 토글로 옵션화됨.

---

## Cycle 4 — 2026-05-08 — ✅ Done
- **제목**: shadcn/ui + Zustand + TanStack Query 스캐폴딩
- **카테고리**: 프런트 스택 / UI 인프라
- **커밋**: `5df4322`
- **변경 파일**: `app/globals.css`, `app/providers.tsx`, `components/ui/button.tsx`, `lib/stores/useUIStore.ts`, `lib/utils.ts`, `tailwind.config.ts`, `components.json`
- **검증**: shadcn 컴포넌트 1개(Button) 렌더, Zustand 스토어 hydrate, TanStack Query 캐시 동작
- **비고**: 이후 Cycle 7+의 Sheet / AlertDialog / Dialog 등도 같은 shadcn 베이스 위에서 추가.

---

## Cycle 5-1 — 2026-05-08 — ✅ Done
- **제목**: Next.js 앱을 `apps/web`로 이동, npm workspaces 도입
- **카테고리**: 모노레포 정리
- **커밋**: `a13d995`
- **변경 파일**: 루트 → `apps/web/`로 통째 이동(컴포넌트/페이지/설정 일체), 루트 `package.json` workspaces 선언
- **검증**: 루트 `npm install` 한 번으로 web + api 둘 다 설치. 기존 모든 기능 회귀 없음.
- **비고**: 이 시점부터 `npm run dev:all` 패턴으로 두 앱 동시 기동.

---

## Cycle 5-2 — 2026-05-08 — ✅ Done
- **제목**: Nginx 리버스 프록시(:80) 추가 (dev profile)
- **카테고리**: 인프라
- **커밋**: `9f23892`
- **변경 파일**: `docker-compose.yml`, `nginx/default.conf`
- **검증**: `http://localhost`로 진입 시 nginx → web(3000) 프록시 정상
- **비고**: dev profile에서만 띄움. LAN 사용자가 80번 표준 포트로 접근하고 싶을 때만.

---

## Cycle 6-1 — 2026-05-08 — ✅ Done
- **제목**: 코드 블록 syntax highlight + 5초 autosave
- **카테고리**: 편집기 (FR-031)
- **커밋**: `89655ce`
- **변경 파일**: `apps/web/components/CodeBlockNodeView.tsx`, `apps/web/lib/tiptap/code-block-lowlight.ts`, `EditorToolbar.tsx`, `CollaborativeEditor.tsx`, `globals.css`
- **검증**: 코드블록 안 텍스트가 언어 선택에 따라 색 입혀짐. 본문 변경 후 5초 idle 시 PATCH `/pages/:id`.
- **비고**: lowlight 기반. 지원 언어 목록은 `code-block-lowlight.ts` 에서 enumerate.

---

## Cycle 6-2 — 2026-05-08 — ✅ Done
- **제목**: 슬래시 명령어 메뉴
- **카테고리**: 편집기 (FR-037)
- **커밋**: `24b0651`
- **변경 파일**: `apps/web/lib/tiptap/slash-command.ts`, `slash-commands.ts`, `components/SlashMenu.tsx`, `CollaborativeEditor.tsx`
- **검증**: 본문에서 `/` 입력 시 명령 팝업. 헤딩/리스트/코드블록/표 등 삽입 가능.
- **비고**: `@tiptap/suggestion` 기반. 이후 Cycle 12-2(이미지), Cycle 20(수식) 등에서 명령 추가됨.

---

## Cycle 6-3 — 2026-05-08 — ✅ Done
- **제목**: 헤딩 기반 목차(TOC) 자동 생성
- **카테고리**: 편집기 (FR-039)
- **커밋**: `da5fd18`
- **변경 파일**: `apps/web/components/TableOfContents.tsx`, `CollaborativeEditor.tsx`, `app/page.tsx`
- **검증**: 본문의 H1~H4를 따라 우측 사이드에 목차 표시. 항목 클릭 시 해당 위치로 스크롤.
- **비고**: editor 인스턴스를 page.tsx → TOC로 prop 전달. 헤딩 levels는 Cycle 9-2에서 H4까지, Cycle 37 followup에서 H6까지 확장.

---

## Cycle 7-1 — 2026-05-08 — ✅ Done
- **제목**: 페이지 버전 스냅샷 + 히스토리 뷰어
- **카테고리**: 버전 관리 (FR-060, FR-061)
- **커밋**: `df184ba`
- **변경 파일**: `apps/api/prisma/migrations/20260508045813_add_page_versions/`, `schema.prisma` (PageVersion), `pages.service.ts` (update 시 version row 생성), `apps/web/components/PageVersionHistory.tsx`, `ui/sheet.tsx`
- **검증**: 본문 변경 후 발행 → PageVersion 한 행 추가. 헤더 🕘 버튼 클릭 시 우측 Sheet에 시간순 목록.
- **비고**: 이 사이클에선 모든 update가 version 생성. Cycle 10 이후 draft/publish 분리되면서 발행 시점에만 version 생성으로 변경됨.

---

## Cycle 7-2 — 2026-05-08 — ✅ Done
- **제목**: 페이지 버전 원복
- **카테고리**: 버전 관리 (FR-063)
- **커밋**: `43a4645`
- **변경 파일**: `apps/api/src/pages/pages.{controller,service}.ts`, `apps/web/components/PageVersionHistory.tsx`, `ui/alert-dialog.tsx`
- **검증**: 히스토리에서 "원복" 클릭 → 확인 다이얼로그 → 해당 버전의 title/content가 현재로 복구되며 새 PageVersion 한 행 추가
- **비고**: 원복도 history 한 줄을 만들기 때문에 사용자가 실수해도 다시 되돌릴 수 있음.

---

## Cycle 7-3 — 2026-05-08 — ✅ Done
- **제목**: 페이지 버전 비교(diff)
- **카테고리**: 버전 관리 (FR-062)
- **커밋**: `cadbf11`
- **변경 파일**: `apps/web/components/PageVersionDiff.tsx`, `lib/version-diff.ts`, `PageVersionHistory.tsx`
- **검증**: 히스토리 카드에서 "비교" → 직전 버전과의 diff 라인 단위로 표시
- **비고**: diff-match-patch 기반. 최초 버전은 "이전 버전 없음" 표시.

---

## Cycle 7-4 — 2026-05-08 — ✅ Done
- **제목**: 버전 보관 정책 (retention)
- **카테고리**: 버전 관리 (FR-064)
- **커밋**: `d3becba`
- **변경 파일**: `apps/api/.env.example` (PAGE_VERSION_RETENTION), `pages.service.ts` (cleanupOldVersions)
- **검증**: 페이지당 50건 초과 시 가장 오래된 것부터 삭제. update/publish/restore 모두 같은 트랜잭션에서 정리.
- **비고**: env 미설정 시 50으로 폴백. 0/음수 입력은 무시(safety net).

---

## Cycle 8-1 — 2026-05-11 — ✅ Done
- **제목**: 첨부 백엔드 — 업로드/리스트/다운로드/삭제 + 페이지 cleanup
- **카테고리**: 첨부파일 (FR-080~083)
- **커밋**: `34e112d`
- **변경 파일**: `apps/api/prisma/migrations/20260511004348_add_attachments/`, `schema.prisma` (Attachment), `apps/api/src/attachments/` 모듈, `pages.service.ts` (cascade cleanup), `.env.example` (ATTACHMENT_STORAGE_PATH/MAX_SIZE_MB), `.gitignore`, `storage/attachments/.gitkeep`
- **검증**: multipart/form-data 업로드. storageKey UUID로 디스크 저장, 메타데이터는 DB. 페이지 영구삭제 시 디스크 파일도 정리.
- **비고**: 단일 파일 최대 100MB. SRS 3장 "로컬 파일 시스템 1차" 결정에 따른 단순 구현.

---

## Cycle 8-2 — 2026-05-11 — ✅ Done
- **제목**: 첨부 UI — 리스트/업로드/다운로드/삭제 (기본)
- **카테고리**: 첨부파일 UI
- **커밋**: `7d7bb0d`
- **변경 파일**: `apps/web/components/AttachmentList.tsx`, `app/page.tsx`, `lib/format.ts`
- **검증**: 페이지 하단 첨부 영역에 파일 카드 목록. 클릭 다운로드, ×로 삭제.

---

## Cycle 8-3 — 2026-05-11 — ✅ Done
- **제목**: 첨부 UX — 업로드 진행률 / 드래그앤드롭 / 이미지 미리보기
- **카테고리**: 첨부파일 UX
- **커밋**: `83594d6`
- **변경 파일**: `apps/web/components/AttachmentList.tsx`
- **검증**: 파일 드래그 시 영역 하이라이트, 업로드 중 % 게이지, image/* 는 썸네일.

---

## Cycle 9-1 — 2026-05-11 — ✅ Done
- **제목**: 체크리스트 + 텍스트/배경 색상
- **카테고리**: 편집기 (FR-030 partial)
- **커밋**: `629482d`
- **변경 파일**: `apps/web/components/CollaborativeEditor.tsx`, `EditorToolbar.tsx`, `EditorColorPicker.tsx`, `ui/dropdown-menu.tsx`, `lib/tiptap/slash-commands.ts`, `globals.css`
- **검증**: 슬래시/툴바에서 체크리스트 삽입. 글자색/형광펜 팔레트.
- **비고**: 색상/형광펜은 Markdown 직렬화 후 새로고침 시 시각적으로 소실(알려진 한계, Cycle 16 시점 swtest.md에 명시).

---

## Cycle 9-1a — 2026-05-11 — ✅ Done
- **제목**: 조회 모드에서도 체크박스 토글 허용 (TaskItem onReadOnlyChecked)
- **카테고리**: 편집기 UX 보강
- **커밋**: `7eb5e70`
- **변경 파일**: `apps/web/components/CollaborativeEditor.tsx`
- **검증**: editable=false인 조회 모드에서도 ☐/☑ 클릭 → 즉시 토글
- **비고**: editor.editable과 무관하게 체크박스만 활성. 단, 이 시점엔 변경이 영속화되지 않음 — Cycle 9-1b/10-2b-2에서 해결.

---

## Cycle 9-1b — 2026-05-11 — ✅ Done
- **제목**: TaskItem NodeView + 조회 모드 autosave
- **카테고리**: 편집기 UX
- **커밋**: `20290eb`
- **변경 파일**: `apps/web/components/CollaborativeEditor.tsx`, `TaskItemNodeView.tsx` (신규)
- **검증**: 조회 모드 체크박스 토글이 Y.Doc transaction을 만들고 다른 클라이언트로 전파, autosave 진입.
- **비고**: React NodeViewRenderer로 체크박스 핸들러를 직접 컨트롤. 이후 Cycle 10-2b-2에서 "즉시 발행" 흐름으로 보강.

---

## Cycle 9-1c — 2026-05-11 — ✅ Done
- **제목**: TaskList 체크박스를 텍스트와 라인 정렬
- **카테고리**: 편집기 CSS 보강
- **커밋**: `a6fb3d0`
- **변경 파일**: `apps/web/app/globals.css`
- **검증**: 체크박스가 첫 글자 baseline에 맞춰 정렬. li 안 p 의 margin 0 처리.

---

## Cycle 9-1d — 2026-05-11 — ✅ Done
- **제목**: TaskItem CSS 강화 (li[data-type] + !important + p inline)
- **카테고리**: 편집기 CSS 보강
- **커밋**: `3a4f9ab`
- **변경 파일**: `apps/web/app/globals.css`
- **검증**: 일부 환경에서 prose 스타일에 눌리던 체크박스가 항상 우선 표시.
- **비고**: !important 사용은 prose가 globals.css 후에 평가되는 빌드 순서 충돌 대응책.

---

## Cycle 9-2 — 2026-05-11 — ✅ Done
- **제목**: 밑줄 mark + H4 헤딩 (FR-030 complete)
- **카테고리**: 편집기
- **커밋**: `f677979`
- **변경 파일**: `apps/web/components/CollaborativeEditor.tsx`, `EditorToolbar.tsx`, `lib/tiptap/slash-commands.ts`
- **검증**: 툴바/슬래시에서 밑줄 토글 + H4 진입. 마크다운 자동변환 `####` 도 동작.
- **비고**: 헤딩 levels는 [1..4]로 고정 (Cycle 37 followup에서 H6까지 확장).

---

## Cycle 10-1 — 2026-05-11 — ✅ Done
- **제목**: 임시저장/발행 백엔드 (Page.draftContent + APIs)
- **카테고리**: 임시저장/발행 (FR-038)
- **커밋**: `d84d677`
- **변경 파일**: `apps/api/prisma/migrations/20260511053647_add_page_draft_content/`, `schema.prisma` (Page.draftContent), `pages.{controller,service}.ts`, `dto/update-draft.dto.ts`, `dto/publish-page.dto.ts`
- **검증**: PATCH `/pages/:id/draft`로 draftContent만 갱신. POST `/pages/:id/publish`로 draftContent → content 승격 + 비움 + PageVersion 생성.
- **비고**: 모두 한 트랜잭션. 발행 시점에만 history에 기록 — Cycle 7-1의 "매 update마다 version"에서 변경.

---

## Cycle 10-2a — 2026-05-11 — ✅ Done
- **제목**: draft autosave + 발행 버튼 (프런트)
- **카테고리**: 임시저장/발행 UI
- **커밋**: `95444b3`
- **변경 파일**: `apps/web/app/page.tsx`, `CollaborativeEditor.tsx`, `PageHeader.tsx`, `lib/types.ts` (PageFull.draftContent)
- **검증**: 본문 변경 5초 idle → /draft PATCH, "저장됨" 표시. 헤더 "발행" 버튼은 hasDraft일 때만 활성.
- **비고**: 자동저장 디바운스 타이밍이 Cycle 36의 "두 번 발행 버그" 원인이 됨 — 그때 publish가 클라이언트 content를 직접 송신하도록 수정.

---

## Cycle 10-2b-1 — 2026-05-11 — ✅ Done
- **제목**: editable 모드별로 Yjs 세션 분리
- **카테고리**: 협업 / 편집 모드
- **커밋**: `0b6ed1a`
- **변경 파일**: `apps/web/components/CollaborativeEditor.tsx`, `app/page.tsx`
- **검증**: 조회 모드 사용자는 다른 사용자의 임시 draft가 보이지 않음. 편집 모드 전환 시 key prop 변경으로 컴포넌트 재마운트.
- **비고**: 조회 모드는 useEditor의 content prop으로 published 내용을 직접 시드, 편집 모드만 Collaboration extension 활성.

---

## Cycle 10-2b-2 — 2026-05-11 — ✅ Done
- **제목**: 조회 모드 체크박스 토글 시 즉시 발행
- **카테고리**: 편집기 UX
- **커밋**: `d7719b2`
- **변경 파일**: `apps/web/components/TaskItemNodeView.tsx`, `app/page.tsx`, `lib/stores/usePageStore.ts`
- **검증**: 조회 모드에서 체크 → 백엔드 publish 호출 → DB 영속화. 작성자명은 store에서 가져옴.

---

## Cycle 11-1 — 2026-05-11 — ✅ Done
- **제목**: 내부 페이지 링크 — 검색 API + 링크 다이얼로그 (FR-034 partial)
- **카테고리**: 편집기 / 링크
- **커밋**: `b224bef`
- **변경 파일**: `apps/api/src/pages/pages.{controller,service}.ts` (search 엔드포인트), `apps/web/components/InternalPageLinkDialog.tsx`, `EditorToolbar.tsx`, `ui/dialog.tsx`
- **검증**: 툴바 🔗 → 모달에서 외부 URL 또는 내부 페이지 검색 → 선택 시 link mark.
- **비고**: 검색 API는 ILIKE 기반. Cycle 15에서 pg_trgm 인덱스 가속.

---

## Cycle 11-2 — 2026-05-11 — ✅ Done
- **제목**: 내부 페이지 링크의 SPA 라우팅 (URL pageId 동기 + click 위임)
- **카테고리**: 라우팅 / 내부 링크
- **커밋**: `ed4036d`
- **변경 파일**: `apps/web/app/page.tsx`
- **검증**: 본문 안 내부 페이지 링크 클릭 시 풀 페이지 리로드 없이 `?pageId=<id>` 로 SPA 전환.
- **비고**: document-level click handler에서 anchor 가로채기. Ctrl/Meta-click은 새 탭으로 폴백.

---

## Cycle 12-1 — 2026-05-11 — ✅ Done
- **제목**: 본문 인라인 이미지 (드롭/붙여넣기 업로드, 첨부 인프라 재사용)
- **카테고리**: 미디어 (FR-033)
- **커밋**: `89aa5dd`
- **변경 파일**: `apps/web/components/CollaborativeEditor.tsx`, `globals.css`, `package.json` (@tiptap/extension-image)
- **검증**: 본문에 이미지 파일 드롭 또는 스크린샷 붙여넣기 → POST `/attachments` → image 노드 인라인 삽입.
- **비고**: handleDrop/handlePaste editorProps. 100MB 초과 시 alert.

---

## Cycle 12-2 — 2026-05-11 — ✅ Done
- **제목**: 외부 URL 이미지 + alt 편집 (툴바 + 슬래시)
- **카테고리**: 미디어
- **커밋**: `497464e`
- **변경 파일**: `apps/web/components/EditorToolbar.tsx`, `lib/tiptap/slash-commands.ts`
- **검증**: 툴바 🖼️ → URL/alt prompt. 선택된 이미지 노드 → 📝로 alt 재편집.

---

## Cycle 13 — 2026-05-11 — ✅ Done
- **제목**: 마크다운 input rules (체크리스트/링크/이미지)
- **카테고리**: 편집기 (FR-036)
- **커밋**: `43963b6`
- **변경 파일**: `apps/web/lib/tiptap/markdown-input-rules.ts` (신규), `CollaborativeEditor.tsx`
- **검증**: `- [ ] ` 입력 → 체크리스트. `[text](url) ` 입력 → 링크. `![alt](url) ` → 이미지.
- **비고**: StarterKit이 커버 못하는 케이스만 추가.

---

## Cycle 14 — 2026-05-12 — ✅ Done
- **제목**: 표 행/열/병합/분할 명령
- **카테고리**: 편집기 (FR-032)
- **커밋**: `49f5b1d`
- **변경 파일**: `apps/web/components/EditorToolbar.tsx`
- **검증**: 표 셀에 커서 → 툴바에 행/열 추가·삭제, 셀 병합·분할, 표 삭제 버튼 노출
- **비고**: 표 선택 시 컨텍스트별 button group으로 표시. 표 자체 삽입은 Cycle 6-2 슬래시 메뉴/Cycle 37의 ▦ 버튼.

---

## Cycle 15-1a — 2026-05-12 — ✅ Done
- **제목**: 전문 검색 백엔드 (ILIKE + pg_trgm 인덱스 + snippet)
- **카테고리**: 검색 (FR-090, FR-092)
- **커밋**: `f6abf77`
- **변경 파일**: `apps/api/prisma/migrations/20260512074425_enable_pg_trgm_full_search/`, `pages.{controller,service}.ts`
- **검증**: GET `/pages/full-search?q=...` → 제목/본문 ILIKE 매칭, 본문 매칭 부근 60자 snippet 반환
- **비고**: GIN trigram 인덱스 두 개(title, content). 한국어 부분 일치 가속.

---

## Cycle 15-1b — 2026-05-12 — ✅ Done
- **제목**: 빠른 검색 팝업 (Ctrl+K)
- **카테고리**: 검색 UX (FR-093)
- **커밋**: `5f15f1b`
- **변경 파일**: `apps/web/components/QuickSearchDialog.tsx`, `app/page.tsx`
- **검증**: Ctrl/Cmd+K → 검색 input + 결과 목록. 선택 시 해당 페이지로 이동.
- **비고**: Cycle 31에서 풀스크린 SearchOverlay로 재설계됨.

---

## Cycle 15-2 — 2026-05-12 — ✅ Done
- **제목**: 검색 결과 페이지 + 키워드 하이라이트 + 페이지네이션
- **카테고리**: 검색 UX
- **커밋**: `d8a2374`
- **변경 파일**: `apps/web/app/search/page.tsx`, `QuickSearchDialog.tsx`, `lib/highlight.tsx`
- **검증**: `/search?q=...` 진입 시 결과 카드 목록, 매칭 텍스트가 하이라이트, 페이지 네비 동작
- **비고**: highlight는 토큰 단위로 안전하게 React node 분리.

---

## Cycle 15-3 — 2026-05-12 — ✅ Done
- **제목**: 검색 필터 (스페이스/날짜/정렬)
- **카테고리**: 검색 (FR-091)
- **커밋**: `85c6236`
- **변경 파일**: `apps/api/src/pages/pages.{controller,service}.ts`, `apps/web/app/search/page.tsx`
- **검증**: 검색 결과에 좌측 필터 패널 — 스페이스 선택, 날짜 범위, 정렬 (관련도/최신/수정).
- **비고**: 단수/다중 spaceIds/authorIds 모두 흡수 (콤마 구분 + 단수 동시 지원).

---

## Cycle 16-1a — 2026-05-12 — ✅ Done
- **제목**: 댓글 백엔드 — Comment 모델 + CRUD
- **카테고리**: 댓글 (FR-070)
- **커밋**: `ce53e76`
- **변경 파일**: `apps/api/prisma/migrations/20260511231747_add_comments/`, `schema.prisma`, `apps/api/src/comments/` 모듈 + 2개 DTO
- **검증**: 페이지당 댓글 목록/생성/수정/삭제. parentId self-relation 준비(스레드는 16-2).
- **비고**: 인증은 Cycle 27d에서 부착(authorId FK).

---

## Cycle 16-1b — 2026-05-12 — ✅ Done
- **제목**: 페이지 댓글 UI (목록/작성/수정/삭제)
- **카테고리**: 댓글 UI
- **커밋**: `fda1d50`
- **변경 파일**: `apps/web/app/page.tsx`, `components/PageComments.tsx` (신규)
- **검증**: 페이지 하단에 댓글 입력창 + 목록. 본인 댓글 수정/삭제 가능.

---

## Cycle 16-2a — 2026-05-12 — ✅ Done
- **제목**: 댓글 답글 스레드 (replies + nested rendering)
- **카테고리**: 댓글
- **커밋**: `7523403`
- **변경 파일**: `apps/web/components/PageComments.tsx`
- **검증**: 댓글에 "답글" → 1단계 들여쓰기로 표시. 깊이 1단까지(중첩 무한 아님).

---

## Cycle 16-3a — 2026-05-12 — ✅ Done
- **제목**: 인라인 댓글 백엔드 (isInline + anchor + resolve)
- **카테고리**: 인라인 댓글 (FR-071)
- **커밋**: `45ea86d`
- **변경 파일**: `apps/api/prisma/migrations/20260512090901_add_inline_comments/`, `schema.prisma` (Comment.isInline/anchorJson/resolvedAt/resolvedBy), `comments.{controller,service}.ts`, `dto/create-comment.dto.ts`, `dto/resolve-comment.dto.ts`
- **검증**: isInline=true 댓글에 anchorJson(ProseMirror from/to + 선택 텍스트) 저장. 해결 처리 가능.

---

## Cycle 16-3b-1 — 2026-05-12 — ✅ Done
- **제목**: 인라인 댓글 mark + 작성 흐름 (FR-071 partial)
- **카테고리**: 인라인 댓글 UI
- **커밋**: `7836411`
- **변경 파일**: `apps/web/lib/tiptap/inline-comment-mark.ts` (신규), `components/InlineCommentDialog.tsx`, `EditorToolbar.tsx`, `CollaborativeEditor.tsx`, `globals.css`
- **검증**: 본문 텍스트 선택 → 툴바 💬 → 다이얼로그에서 코멘트 입력 → mark가 박힘 (노란색 배경).

---

## Cycle 16-3b-2 — 2026-05-12 — ✅ Done
- **제목**: 인라인 댓글 사이드바 + 해결 처리 (FR-071 complete)
- **카테고리**: 인라인 댓글 UI
- **커밋**: `50ce38b`
- **변경 파일**: `apps/web/components/InlineCommentsList.tsx` (신규), `app/page.tsx`
- **검증**: 페이지 하단/우측에 인라인 댓글 목록. mark 클릭 → 해당 댓글로 스크롤. 해결 시 mark 제거.

---

## Cycle 17 — 2026-05-12 — ✅ Done
- **제목**: pg_trgm + GIN trigram 인덱스 복원
- **카테고리**: 검색 성능 (FR-090 perf)
- **커밋**: `5cb5ac1`
- **변경 파일**: `apps/api/prisma/migrations/20260512101926_restore_pg_trgm/`, `schema.prisma` (raw GIN index)
- **검증**: Page.title / Page.content 양쪽에 GIN(gin_trgm_ops) 인덱스가 schema에 명시 → 향후 prisma migrate가 자동 DROP하지 않음.
- **비고**: Cycle 15에서 만든 인덱스가 schema에 등록되지 않아 다른 마이그레이션이 drop하는 사고를 막기 위한 명시화.

---

## Cycle 18-1a — 2026-05-12 — ✅ Done
- **제목**: 페이지 휴지통 (soft delete + restore 백엔드)
- **카테고리**: 페이지 관리 (FR-024)
- **커밋**: `627f968`
- **변경 파일**: `apps/api/prisma/migrations/20260512110921_add_page_trash/`, `schema.prisma` (deletedAt), `pages.{controller,service}.ts` (remove/restore/permanentDelete/listTrash), `spaces.service.ts` (휴지통 제외 필터)
- **검증**: DELETE는 soft (deletedAt 세팅). POST `/:id/restore`로 복구. POST `/:id/permanent-delete`로 영구 삭제 + 디스크 첨부 정리.
- **비고**: 자식까지 cascade. 모든 일반 조회는 `deletedAt: null` 필터.

---

## Cycle 18-1b — 2026-05-12 — ✅ Done
- **제목**: 휴지통 UI (Sheet + 복구 + 영구 삭제)
- **카테고리**: 페이지 관리 UI
- **커밋**: `4f1d630`
- **변경 파일**: `apps/web/components/TrashSheet.tsx` (신규), `Sidebar.tsx`, `app/page.tsx`
- **검증**: 사이드바 🗑️ → 우측 Sheet에 휴지통 목록. 복구/영구삭제 버튼.

---

## Cycle 18-2 — 2026-05-12 — ✅ Done
- **제목**: 페이지 즐겨찾기 (localStorage)
- **카테고리**: 페이지 관리 (FR-025)
- **커밋**: `dcf0293`
- **변경 파일**: `apps/web/components/PageHeader.tsx`, `Sidebar.tsx`, `lib/stores/useFavoritesStore.ts`
- **검증**: 헤더 ☆/⭐ 토글. 사이드바 "즐겨찾기" 섹션에 별표 페이지만 노출.
- **비고**: 인증 도입 전이라 localStorage. Cycle 27 이후에도 서버 동기화로 옮기진 않음.

---

## Cycle 18-3a — 2026-05-12 — ✅ Done
- **제목**: 페이지 이동 백엔드 (spaceId + parentId + cascade + cycle check)
- **카테고리**: 페이지 관리 (FR-022)
- **커밋**: `dae34f5`
- **변경 파일**: `apps/api/src/pages/dto/update-page.dto.ts`, `pages.service.ts`
- **검증**: PATCH `/pages/:id`에 spaceId/parentId 동시 변경 가능. 자손은 모두 함께 새 spaceId로. 자기 자신/자손을 부모로 지정 시 400.

---

## Cycle 18-3b — 2026-05-12 — ✅ Done
- **제목**: 페이지 이동 UI
- **카테고리**: 페이지 관리 UI
- **커밋**: `e782059`
- **변경 파일**: `apps/web/components/MovePageDialog.tsx` (신규), `app/page.tsx`, `PageHeader.tsx`
- **검증**: 헤더 ↗ → 다른 스페이스/부모로 이동 다이얼로그.

---

## Cycle 18-4a — 2026-05-12 — ✅ Done
- **제목**: 페이지 복사 백엔드 (deep + recursive 옵션)
- **카테고리**: 페이지 관리 (FR-023)
- **커밋**: `2ab15dd`
- **변경 파일**: `apps/api/src/pages/dto/copy-page.dto.ts`, `pages.{controller,service}.ts`
- **검증**: POST `/pages/:id/copy` → 새 Page row + 첨부 디스크 복사 + 다이어그램 복제. recursive=true면 자손까지.
- **비고**: 디스크 복사는 트랜잭션 직전. 트랜잭션 실패 시 이미 복사한 파일 cleanup.

---

## Cycle 18-4b — 2026-05-12 — ✅ Done
- **제목**: 페이지 복사 UI
- **카테고리**: 페이지 관리 UI
- **커밋**: `5176844`
- **변경 파일**: `apps/web/components/CopyPageDialog.tsx` (신규), `app/page.tsx`, `PageHeader.tsx`
- **검증**: 헤더 ⧉ → 대상 스페이스/부모 + 새 제목 + 자손 포함 옵션.

---

## Cycle 19a — 2026-05-12 — ✅ Done
- **제목**: 페이지 reorder 백엔드 (position 컬럼 + 형제 재배열)
- **카테고리**: 사이드바 트리 (FR-021 backend)
- **커밋**: `231ff45`
- **변경 파일**: `apps/api/prisma/migrations/20260512132342_add_page_position/`, `schema.prisma` (position + (parentId, position) index), `pages.service.ts`, `spaces.service.ts` (orderBy position)
- **검증**: PATCH `/pages/:id` 에 position 명시 또는 parentId 변경 시 형제 그룹 일괄 재부여 (0,1,2,...).

---

## Cycle 19b — 2026-05-12 — ✅ Done
- **제목**: 사이드바 드래그앤드롭 트리 (dnd-kit)
- **카테고리**: 사이드바 트리 (FR-021 frontend)
- **커밋**: `9561dd2`
- **변경 파일**: `apps/web/components/Sidebar.tsx`, `app/page.tsx`, `package.json` (@dnd-kit)
- **검증**: 사이드바 페이지 드래그 → over rect 상/중/하 1/3로 before/child/after 결정. 자손 위로는 drop 차단.

---

## Cycle 20 — 2026-05-12 — ✅ Done
- **제목**: LaTeX 수식 (KaTeX 인라인 + 블록)
- **카테고리**: 편집기 (FR-040)
- **커밋**: `a0c6bf1`
- **변경 파일**: `apps/web/lib/tiptap/math-{inline,block}.ts` (신규), `MathInlineView.tsx`, `MathBlockView.tsx`, `CollaborativeEditor.tsx`, `markdown-input-rules.ts`, `slash-commands.ts`, `globals.css`, `package.json` (katex)
- **검증**: `$x^2$` 자동변환 → 인라인 수식. `$$...$$` → 블록 수식. NodeView에서 KaTeX 렌더.

---

## Cycle 21 — 2026-05-12 — ✅ Done
- **제목**: 페이지 내보내기 — Markdown 다운로드 + PDF (print CSS)
- **카테고리**: 내보내기 (FR-121, FR-122)
- **커밋**: `a7a5260`
- **변경 파일**: `apps/web/lib/export/markdown.ts`, `print.ts`, `PageHeader.tsx`, `globals.css` (@media print)
- **검증**: 헤더 ⋯ → "Markdown 내보내기" 즉시 다운로드 / "PDF 내보내기"는 브라우저 인쇄 다이얼로그.

---

## Cycle 22 — 2026-05-12 — ✅ Done
- **제목**: 홈 대시보드 (최근 방문 + 즐겨찾기 + 최근 수정)
- **카테고리**: 홈 (FR-130)
- **커밋**: `f97fe74`
- **변경 파일**: `apps/web/app/home/page.tsx`, `app/page.tsx`, `components/PageCard.tsx`, `Sidebar.tsx`, `TopNav.tsx`, `lib/stores/useRecentPagesStore.ts`, `apps/api/src/pages/pages.{controller,service}.ts` (recent 엔드포인트)
- **검증**: `/home` 진입 시 3개 섹션 카드. 최근 방문은 localStorage, 최근 수정은 백엔드.
- **비고**: Cycle 28~29에서 view 탭 시스템 + Confluence 스타일로 재설계.

---

## Cycle 23 — 2026-05-12 — ✅ Done
- **제목**: 페이지 공유 링크 (토큰 기반 read-only 공개 라우트)
- **카테고리**: 공유 (FR-120)
- **커밋**: `b47c38a`
- **변경 파일**: `apps/api/prisma/migrations/20260512172726_add_page_share/`, `schema.prisma` (PageShare), `apps/api/src/page-shares/` 모듈, `apps/web/app/share/[token]/page.tsx`, `components/SharePageDialog.tsx`, `PageHeader.tsx`
- **검증**: ⋯ → 공유 링크 → 토큰 생성. `/share/<token>` 접근 시 인증 없이 read-only 페이지 본문 노출. revoke 가능.

---

## Cycle 24 — 2026-05-13 — ✅ Done
- **제목**: 활동 로그 + 피드 (페이지 CRUD + 댓글 타임라인 + 필터)
- **카테고리**: 활동 피드 (FR-131)
- **커밋**: `346e419`
- **변경 파일**: `apps/api/prisma/migrations/20260513090420_add_activity_log/`, `schema.prisma` (ActivityLog), `apps/api/src/activities/` 모듈, `pages.service.ts` / `comments.service.ts` (log 호출), `apps/web/app/activity/page.tsx`, `home/page.tsx`, `Sidebar.tsx`, `lib/activity-format.ts`
- **검증**: 페이지 created/moved/copied/soft_deleted/restored/permanent_deleted + 댓글 created 8종 이벤트가 타임라인에 표시. 스페이스 필터.

---

## Cycle 25 — 2026-05-13 — ✅ Done
- **제목**: 페이지/댓글 이모지 반응 (익명 UUID 토글)
- **카테고리**: 댓글/반응 (FR-073)
- **커밋**: `8e9d0f0`
- **변경 파일**: `apps/api/prisma/migrations/20260513092806_add_reaction/`, `schema.prisma` (Reaction), `reactions/` 모듈, `apps/web/components/ReactionBar.tsx`, `PageComments.tsx`, `lib/stores/useReactorStore.ts`
- **검증**: 페이지/댓글 아래 ReactionBar — 이모지 클릭 토글, 카운트 + 누가 눌렀는지 hover.
- **비고**: Cycle 27e에서 익명 reactorId/Name → User FK로 마이그레이션됨.

---

## Cycle 26 — 2026-05-13 — ✅ Done
- **제목**: 오프라인 편집 (y-indexeddb + 연결 상태 표시)
- **카테고리**: 협업 (FR-054)
- **커밋**: `d9347cc`
- **변경 파일**: `apps/web/components/CollaborativeEditor.tsx`, `PageHeader.tsx`, `app/page.tsx`, `package.json` (y-indexeddb)
- **검증**: Y.Doc을 IndexedDB에 persist → 오프라인에서도 마지막 상태 복원 + 편집 즉시 영속. 재연결 시 CRDT 자동 merge. 헤더에 연결 상태 뱃지(online-syncing/offline/reconnecting), 본문 위 오프라인 배너.
- **비고**: status 추적은 이후 Cycle 34 보강에서 provider.status 직접 읽기 → 이벤트 페이로드로 변경.

---

## Cycle 27a — 2026-05-13 — ✅ Done
- **제목**: 인증 백엔드 — User 모델 + signup/login/me + JWT 쿠키
- **카테고리**: 인증 (FR-001, FR-002)
- **커밋**: `5af309b`
- **변경 파일**: `apps/api/prisma/migrations/20260513102226_add_user_and_role/`, `schema.prisma` (User + Role enum), `auth/` 모듈, `dto/{login,signup}.dto.ts`, `jwt.strategy.ts`, `jwt-auth.guard.ts`, `main.ts` (cookie-parser)
- **검증**: POST `/auth/signup` → bcrypt 해시 + JWT 쿠키 셋. POST `/auth/login`, `/auth/logout`, GET `/auth/me`. 첫 가입자는 자동 ADMIN.
- **비고**: httpOnly + sameSite=Lax 쿠키. 토큰은 만료 7일.

---

## Cycle 27b — 2026-05-13 — ✅ Done
- **제목**: 인증 프런트 — /login, /signup, useAuth, middleware redirect
- **카테고리**: 인증 UI
- **커밋**: `c818a01`
- **변경 파일**: `apps/web/app/login/page.tsx`, `signup/page.tsx`, `components/TopNav.tsx` (UserMenu), `lib/api.ts`, `lib/auth/useAuth.ts`, `middleware.ts`
- **검증**: 미인증으로 보호 라우트 진입 시 `/login` redirect. TopNav 우측에 사용자 메뉴 (이름/부서/역할 + 로그아웃).

---

## Cycle 27c — 2026-05-13 — ✅ Done
- **제목**: Page author/lastEditor + 모든 mutation에 JwtAuthGuard
- **카테고리**: 인증 phase 3 (FR-001, FR-002)
- **커밋**: `cca5b3a`
- **변경 파일**: `apps/api/prisma/migrations/20260513104607_add_page_author/`, `schema.prisma` (Page.authorId/lastEditorId), `pages.{controller,service,module}.ts`, `types/express.d.ts`, `apps/web/components/PageHeader.tsx`, `lib/types.ts`
- **검증**: 페이지 생성/수정 시 로그인한 사용자 id가 author/lastEditor에 기록. 헤더에 "작성자: <이름>(부서)" 표시.

---

## Cycle 27d — 2026-05-13 — ✅ Done
- **제목**: Comment.authorId + PageShare.createdById + 모든 mutation JwtAuthGuard
- **카테고리**: 인증 phase 3
- **커밋**: `6173920`
- **변경 파일**: `apps/api/prisma/migrations/20260513110602_add_comment_author_share_creator/`, `schema.prisma` (Comment.authorId, PageShare.createdById), `comments.{controller,service,module}.ts`, `page-shares.{controller,service,module}.ts`, `apps/web/components/{PageComments,InlineCommentDialog,InlineCommentsList,SharePageDialog}.tsx`
- **검증**: 댓글/공유링크 생성 시 사용자 FK 박힘. user 삭제 시 SetNull → authorName fallback.

---

## Cycle 27e — 2026-05-13 — ✅ Done
- **제목**: ActivityLog.actorId + Reaction.userId migration (인증 phase 3 complete)
- **카테고리**: 인증 phase 3
- **커밋**: `c4af6ea`
- **변경 파일**: `apps/api/prisma/migrations/20260513112031_add_activity_actor_reaction_user/`, `schema.prisma`, `activities.service.ts`, `reactions.{controller,service,module}.ts`, `apps/web/components/ReactionBar.tsx`, `lib/activity-format.ts`, `lib/stores/useReactorStore.ts`
- **검증**: 활동 로그가 누구 행위인지 정확히 표시. 같은 (target, emoji, user) 조합은 DB unique로 강제.
- **비고**: 익명 reactorId/Name 컬럼 폐지. Cycle 27a~e로 모든 사용자 행위에 FK 부여 완료.

---

## Cycle 28 — 2026-05-13 — ✅ Done
- **제목**: TopNav + Sidebar 영속 셸 (route group "(app)") — Confluence-like layout
- **카테고리**: 레이아웃 / UX
- **커밋**: `f6bc801`
- **변경 파일**: `apps/web/app/(app)/{layout,page,home/page,activity/page,search/page}.tsx`
- **검증**: `/`, `/home`, `/activity`, `/search` 모두 동일한 TopNav + Sidebar 셸 위에 main만 갱신. 라우트 전환에도 spaces fetch 1회.
- **비고**: `/login`, `/signup`, `/share/<token>` 은 (app) 밖이라 셸 없음.

---

## Cycle 29 — 2026-05-13~14 — ✅ Done
- **제목**: 시스템/스페이스 사이드바 컨텍스트 분리 + /home 5섹션 재설계 (Confluence-like UX)
- **카테고리**: 레이아웃 / 홈 / UX
- **커밋**: `d9c23c0` (main split), `35a41ee` (h2 sections + anchor scroll), `e5181ae` (empty-space fallback fix), `a651a0d` (starred spaces), `8fba32d` `8b45b8f` `cedd53c` `f7bdad3` `071ba82` `1251244` `1c9af40` `d501cfb` (별표 버튼 폴리시 7건), `358d1d3` (view 탭 시스템 + 로고 클릭 full reload), `210c5ec` (페이지 수 숫자 제거), `60e06e4` (TopNav 공간 드롭다운 재설계 + /spaces 라우트), `1aa4400` (/spaces 사이드바 없는 검색 페이지), `8d34769` (드롭다운 설명 제거 + 좌측 정렬 폴리시)
- **변경 파일**: `apps/web/app/(app)/{layout,page,home/page,spaces/page}.tsx`, `components/{SystemSidebar,SpaceStarButton,TopNav,Sidebar}.tsx`, `lib/stores/{useStarredSpacesStore,useRecentSpacesStore}.ts`, `middleware.ts`, `public/icons/star*.png`
- **검증**: `/home`은 SystemSidebar(발견/내 작업/내 공간 3개 섹션, 각 sub-item anchor scroll). 스페이스 진입 후엔 SpaceSidebar(페이지 트리). 별표한 스페이스만 "내 공간" 노출. 빈 스페이스 클릭이 다른 스페이스로 폴백 안 함.
- **비고**: 사이클 안에서 별표 버튼(SpaceStarButton)이 클릭이 안 되는 z-stack 문제로 7개 fix 커밋. 결국 사용 ★ 텍스트 캐릭터(이모지 X) + 카드를 div role=button으로 감싸 nested button 회피.

---

## Cycle 30 — 2026-05-14 — ✅ Done
- **제목**: 공간 디렉터리 페이지 (/spaces) — Confluence 스타일 sub-nav + 테이블
- **카테고리**: 공간 디렉터리
- **커밋**: `a740fb1`
- **변경 파일**: `apps/api/src/spaces/spaces.service.ts` (authorId select 추가), `apps/web/app/(app)/spaces/page.tsx`, `lib/types.ts`
- **검증**: `/spaces` → "모든 공간 / 내 공간 / 별표한 공간 / 최근 사용" sub-nav 탭. 각 탭은 검색 가능 + 페이지네이션된 테이블.

---

## Cycle 31 — 2026-05-14~15 — ✅ Done
- **제목**: Confluence 스타일 풀스크린 검색 오버레이 (FILTER BY 패널 + 드롭다운 + 다중 선택)
- **카테고리**: 검색 UX
- **커밋**: `dffce1b` (FILTER BY 패널 + 스크롤 결과), `86f19f1` (페이지+스페이스 결과 + FILTER BY Space sub-search), `34ee4ec` (드롭다운 필터 버튼 + 다중 선택 체크박스)
- **변경 파일**: `apps/web/components/SearchOverlay.tsx`, `QuickSearchDialog.tsx` (구식 폴백), `app/(app)/page.tsx`, `TopNav.tsx`, `apps/api/src/pages/pages.{controller,service}.ts`, `users/{controller,module,service}.ts`
- **검증**: Ctrl+K 또는 상단 검색바 → 풀스크린 오버레이. 좌측 FILTER BY (Space/Author/Date), 우측 결과 카드. 다중 선택 체크박스로 필터 조합.
- **비고**: Cycle 15-1b의 QuickSearchDialog는 dead path로 남음.

---

## Cycle 32 — 2026-05-15 — ✅ Done
- **제목**: 분할 "만들기" 버튼 + 개인 공간 + 빠른 페이지 생성 (편집 모드 진입)
- **카테고리**: 만들기 / 공간
- **커밋**: `40bfd04`
- **변경 파일**: `apps/api/prisma/migrations/20260514231135_add_space_type_owner/`, `schema.prisma` (SpaceType enum + ownerId), `auth/optional-jwt-auth.guard.ts`, `spaces.{controller,service,module}.ts`, `apps/web/app/(app)/page.tsx`, `components/TopNav.tsx`
- **검증**: TopNav "만들기" 분할 버튼. 좌측 main = 컨텍스트 기반 페이지 생성, 우측 ⋯ = 드롭다운(새 페이지 / 새 공간). 컨텍스트 없으면 개인 공간(PERSONAL) lazy 생성. 생성 직후 `?edit=1` 로 편집 모드 자동 진입.

---

## Cycle 33 — 2026-05-15 — ✅ Done
- **제목**: 명시적 공간 홈 페이지 — Space.homePageId, 공간 생성 시 자동 생성, "공간 홈으로 지정" 메뉴
- **카테고리**: 공간 / 홈
- **커밋**: `3dbb913` (main), `4814018` (Main Page 제목 + 빈 공간 백필 fix), `bb0536a` (Sidebar 페이지 클릭 시 spaces[0] 폴백 fix)
- **변경 파일**: `apps/api/prisma/migrations/20260514234917_add_space_home_page/`, `20260514235833_backfill_empty_space_home_page/`, `schema.prisma` (Space.homePageId), `spaces.{controller,service,module}.ts`, `dto/set-home-page.dto.ts`, `apps/web/components/{Sidebar,SystemSidebar,PageHeader,TopNav,SearchOverlay}.tsx`, `app/(app)/{layout,page}.tsx`, `lib/{spaceHome,types}.ts`
- **검증**: 공간 생성 시 "Main Page" 자동 생성 + homePageId로 지정. 페이지 ⋯ → "공간 홈으로 지정". 사이드바 "홈" 클릭 → homePageId.

---

## Cycle 34 — 2026-05-15 — ✅ Done
- **제목**: Confluence 스타일 전체 화면 편집기 + 발행 후 편집 모드 탈출 + 변경 코멘트
- **카테고리**: 편집기 UX
- **커밋**: `af52960`
- **변경 파일**: `apps/api/prisma/migrations/20260515000000_add_page_version_note/`, `schema.prisma` (PageVersion.note), `dto/publish-page.dto.ts`, `pages.service.ts`, `apps/web/components/FullScreenEditor.tsx` (신규), `CollaborativeEditor.tsx`, `PageVersionHistory.tsx`, `app/(app)/page.tsx`
- **검증**: 편집 모드 진입 시 사이드바·본문 영역을 덮는 전체 화면 편집기. 상단 툴바 sticky / breadcrumb / 큰 제목 / 본문 / 하단 바(단어수·저장상태·"무엇을 변경했나요?" + 업데이트/닫기). 발행 시 publishedAt + note 저장 → 조회 모드로 자동 탈출(버그 fix).
- **비고**: CollaborativeEditor의 connection 추적도 provider.status → status 이벤트로 변경 (오프라인 배너 깜빡임 회귀 fix).

---

## Cycle 35 — 2026-05-15 — ✅ Done
- **제목**: 만들기 → draft 페이지(발행 전엔 트리 미노출) + TopNav 편집 중 유지 + 좌측 정렬 편집기 body
- **카테고리**: 만들기 / draft 모델 / 편집기 chrome
- **커밋**: `94ac1c3` (main), `4d8cc64` (followup: recent/search/findAll에서 draft 숨김)
- **변경 파일**: `apps/api/prisma/migrations/20260515010000_add_page_published_at/`, `schema.prisma` (Page.publishedAt), `pages.{controller,service}.ts`, `spaces.service.ts` (PAGES_INCLUDE에 publishedAt), `dto/create-page.dto.ts` (draft 옵션), `apps/web/components/{TopNav,Sidebar,FullScreenEditor}.tsx`, `app/(app)/page.tsx`, `lib/types.ts`
- **검증**: TopNav 만들기 → POST `{draft: true}` → publishedAt=null → Sidebar 트리 숨김 + recent/search 미노출. 첫 발행 시 publishedAt 채움. FullScreenEditor가 fixed top-14로 TopNav 가리지 않음, body 좌측 기준.

---

## Cycle 36 — 2026-05-15 — ✅ Done
- **제목**: publish가 live editor 내용 사용 (double-publish 버그 fix) + alert 제거
- **카테고리**: 편집기 / 발행
- **커밋**: `c019415`
- **변경 파일**: `apps/api/src/pages/dto/publish-page.dto.ts` (content 옵션), `pages.service.ts`, `apps/web/components/FullScreenEditor.tsx`, `app/(app)/page.tsx`
- **검증**: 본문 입력 후 5초 안에 [발행] 클릭해도 즉시 반영(이전엔 두 번 눌러야 보였음). "발행되었습니다" alert 제거 — 조용히 조회 모드로.
- **비고**: 백엔드는 dto.content가 명시되면(빈 문자열 "" 포함) 그 값을 권위로 사용, 미지정 시 기존 draftContent 승격 폴백.

---

## Cycle 37 — 2026-05-15 — ✅ Done
- **제목**: Confluence 스타일 편집기 툴바 (문단 드롭다운 + 그룹별 평평한 바 + 본문 박스 제거)
- **카테고리**: 편집기 툴바
- **커밋**: `ef78502` (main), `96b4595` (followup: 문단 드롭다운 H1~H6 + 취소선 드롭다운 위·아래첨자/등간격/서식지우기)
- **변경 파일**: `apps/web/components/EditorToolbar.tsx` (전면 재작성), `CollaborativeEditor.tsx` (Subscript/Superscript 추가), `FullScreenEditor.tsx`, `package.json` (@tiptap/extension-{subscript,superscript})
- **검증**: H1~H4 개별 버튼 사라지고 "문단 ▾" 드롭다운 — 현재 블록 타입 라벨 + 미리보기 메뉴. 그룹: G1 문단 / G2 B·I·U·S(▾) / G3 색·형광펜 / G4 목록 / G5 삽입 / spacer / G6 undo·redo. 본문의 파란 좌측 테두리/연한 배경 제거.

---

## Cycle 38 — 2026-05-15 — ✅ Done
- **제목**: 툴바 목록 그룹 — 단추형/번호형/작업 + 들여쓰기/내어쓰기 + 좌·중·우 정렬
- **카테고리**: 편집기 툴바
- **커밋**: `759c528` (main), `f3b2837` (followup: 일반 문단/제목에도 indent 활성화), `eb30e3d` (followup: body max-w-5xl 제거)
- **변경 파일**: `apps/web/components/EditorToolbar.tsx` (목록 그룹 확장 + MiniDivider/IndentButton/Icon SVG), `CollaborativeEditor.tsx` (TextAlign + ListShortcuts + BlockIndent extension), `FullScreenEditor.tsx`, `package.json` (@tiptap/extension-text-align)
- **검증**: Ctrl+Shift+B/N 단축키. 들여쓰기/내어쓰기 — 리스트는 sink/liftListItem, 일반 문단/제목은 indent 속성(margin-left ±24px, max 8단계). 좌/중/우 정렬은 paragraph + heading 대상. 본문 폭이 화면 가로폭에 꽉 차게 (max-w-5xl 제거).
- **비고**: 일반 문단의 indent 속성은 markdown 직렬화에 보존되지 않음 — 편집 세션 한정 시각 들여쓰기.

---

## Cycle 39 — 2026-05-18 — ✅ Done
- **제목**: Hocuspocus Redis adapter 옵션화 (USE_REDIS env)
- **카테고리**: 운영 / 인프라
- **커밋**: `c54da73`
- **변경 파일**: `apps/api/src/collaboration/collaboration.service.ts`, `apps/api/.env.example`, `docs/DEPLOY.md` (신규)
- **검증**: USE_REDIS 미설정/false → in-memory 모드("(in-memory, single instance)" 로그). USE_REDIS=true → 기존 Redis pub/sub adapter("with Redis adapter <host>:<port>"). 단일 인스턴스 운영(사내 PC)에서 Redis 없이도 정상 동작.
- **비고**: Cycle 3에서 도입한 Redis 의존을 옵션으로 격하. DEPLOY.md에 단일/멀티 인스턴스/Docker 3 시나리오 정리.

---

## Cycle 40 — 2026-05-19 — ✅ Done
- **제목**: API 프록시 타깃 포트를 API_PORT env로 통제 (PORT 불일치 버그 영구 fix)
- **카테고리**: 운영 / 기술부채 / 사내 PC 셋업
- **커밋**: `61f2930`
- **변경 파일**:
  - `apps/web/next.config.mjs` — destination 하드코딩 `localhost:3001` → `${process.env.API_PORT || '3001'}` 로 환경변수화
  - `apps/api/.env.example` — `PORT=3001` 명시 + "API_PORT와 같은 값이어야 함" 주석
  - `apps/web/.env.example` — `API_PORT=3001` 신규 추가, 같은 주석
  - `docs/DEPLOY.md` — "API 포트 컨벤션" 섹션 + 트러블슈팅 한 줄 추가, 기존 잘못 안내된 4000 → 3001 교정
- **검증**: PORT/API_PORT 미설정으로 둬도 양쪽 코드 기본값(3001) 일치 → 회원가입/로그인 정상. 둘 다 같은 비기본 값(예: 4000/4000)으로 설정해도 동작 — 환경변수 토글이 실제로 적용됨.
- **남은 일**: 없음 — 두 .env.example이 같은 기본값을 가리키도록 동기화 완료.
- **비고**: 사내 PC 셋업 중 사용자가 `.env`에 `PORT=4000`을 잘못 채워 503/ECONNREFUSED 가 났던 사례에서 출발. 새 사내 서버 셋업 전에 코드/문서 양쪽에서 컨벤션을 강제. DEPLOY.md의 기본 포트 안내가 4000으로 남아 있던 회귀도 함께 정리.

---

## Cycle 41 — 2026-05-20 — ✅ Done
- **제목**: 사내 VM (Ubuntu 24.04) 실제 운영 배포 + 운영 인프라 셋업
- **카테고리**: 운영 / 배포 / 인프라
- **커밋**: `95b07e1` (P3018 영구 fix), `9beb58b` (CLAUDE.md), `5e1a40f` (DEPLOY.md 사내 VM 노트), 본 CYCLES.md
- **변경 파일**:
  - `apps/api/prisma/migrations/20260511231747_add_comments/migration.sql` — 두 `DROP INDEX` 를 `IF EXISTS` 로 → fresh DB 멱등 (P3018 영구 fix)
  - `CLAUDE.md` — Claude Code 세션 메모리 (직전 작업으로 추가, 본 사이클에 함께 묶음)
  - `docs/DEPLOY.md` — Prereq Node 20+ 권장, "사내 VM (외부망 제한 + 프록시 환경)" 서브섹션, nginx 리버스 프록시(옵션 A `/collab`) 예시, P3018 트러블슈팅 행 영구 fix 반영
  - `docs/CYCLES.md` — 본 항목
- **검증**: 외부 PC 브라우저 `http://166.79.31.248:8082` 접속 → 로그인/회원가입 ✅, 페이지 작성/저장 ✅, 실시간 협업(WS `/collab`) ✅. VM(166.79.31.248, amadeus-conf)에서 NestJS(:3001+:1234) + Next.js(:3000) nohup 기동, nginx(:80) 리버스 프록시, 호스트 HAProxy `:8082`→`VM:80`.
- **남은 일 (Cycle 42 후보)**:
  - 편집기 첫 진입 시 "업데이트" 버튼 비활성화 race condition
  - `typescript.ignoreBuildErrors` 영구 fix (`CollaborativeEditor.tsx` useEffect cleanup 타입 에러)
  - 서비스 자동 재시작 (systemd 또는 PM2)
  - DB 비밀번호 강화 (현재 `docspace/docspace` 임시)
  - 옵션 B (HAProxy 포트 매핑)로 WebSocket 전환 가능성 검토
- **비고**: VM 한정 임시 패치(`next.config.mjs` 의 `typescript.ignoreBuildErrors=true`)는 commit 대상 아님 — Cycle 42 영구 fix 후 제거. Node 18 + Hocuspocus 4 조합이 `ERR_REQUIRE_ESM` 으로 죽어 Node 20 으로 업그레이드한 것이 이번 배포의 핵심 함정.

---

## Cycle 42 — 2026-05-21 — ✅ Done (컨테이너화 정의 완성 — 로컬 실빌드 검증은 보류, 사유 아래)
- **제목**: 개발 환경 컨테이너화 + 개발용 Keycloak 구성 (AFS/SSO 입주 사전 포장)
- **카테고리**: 운영 / 인프라 / 배포 (Cycle 43 Keycloak OIDC 전환 준비)
- **커밋**: `5a2b0b0`(핵심), `abf5950`(타입 에러 fix), `91c5e6e`(node22 상향+빌드 호출 fix), `2a53843`(compose WS URL env화+keycloak 26.3+루트 .env.example), 본 CYCLES.md(Docs)
- **변경 파일**:
  - `apps/api/Dockerfile` — **Node 22** 멀티스테이지(build=bookworm/runtime=slim). 빌드: `ENV PATH=/app/node_modules/.bin` + 워크스페이스 직접 호출(prisma generate → nest build). 기동 시 `prisma migrate deploy` → `node dist/src/main`
  - `apps/web/Dockerfile` — **Node 22** Next.js standalone. 빌드 ARG `API_HOST`/`API_PORT`/`NEXT_PUBLIC_WS_URL` 주입
  - `apps/web/next.config.mjs` — `output:'standalone'` + `experimental.outputFileTracingRoot`(저장소 루트) + 프록시 호스트 `API_HOST` 분리(기본 localhost)
  - `docker-compose.yml` — `api`/`web`/`keycloak`(이미지 **26.3**) 서비스 추가, web WS URL 환경변수화(`${NEXT_PUBLIC_WS_URL:-ws://localhost:1234}` — VM IP 하드코딩 제거)
  - `infra/keycloak/realm-docspace.json` — realm `docspace` + confidential client `docspace-web`(authorization code) + 테스트 사용자 `testuser`/`testpass`
  - 루트 `.env.example` — compose 가 읽는 `NEXT_PUBLIC_WS_URL` 문서화. `.dockerignore`(루트, context=root라 실효) / `apps/*/.dockerignore`(의도 문서)
  - `apps/api/.env.example`, `apps/web/.env.example` — `KC_*` placeholder
  - `docs/DEPLOY.md` — "3.5 컨테이너 개발 환경" 섹션 + Node 22 반영 + "사내 프록시 환경에서 빌드(EAI_AGAIN)" 서브섹션 + 트러블슈팅 행
- **검증**: 컨테이너화 정의(Dockerfile·compose·realm) 완성. **로컬 실빌드 검증은 보류** — 사유: 로컬 Docker Desktop(WSL2) 컨테이너 빌드 안 `npm ci` 가 사내 프록시를 못 물려받아 `registry.npmjs.org` DNS 실패(`EAI_AGAIN`); npm 10.x 가 이를 `Exit handler never called!` 로 오역해 표시. **Dockerfile 결함 아님이 확정**(디버그 로그로 근본 원인 식별). 실빌드 검증은 프록시·CA 가 갖춰진 환경(Cycle 41 VM / AFS 입주)에서 그 환경 설정과 함께 수행. **인증 코드는 한 줄도 변경 안 함.**
- **남은 일**:
  - **(배포 환경별)** docker 빌드 시 사내 프록시(`HTTP_PROXY`/`HTTPS_PROXY`)+사내 root CA(`NODE_EXTRA_CA_CERTS`) 주입 — 없으면 빌드 내 npm 이 `EAI_AGAIN`. 사내 IP/CA 는 환경 특정이라 repo 미하드코딩. (DEPLOY.md "사내 프록시 환경에서 빌드" 참조)
  - **(Cycle 43)** 자체 JWT → Keycloak OIDC(authorization code) 로그인 전환. issuer 호스트 불일치(컨테이너 `keycloak:8080` vs 외부 `166.79.31.248:8080`) `KC_HOSTNAME` 등으로 정리
  - ~~Cycle 41의 `typescript.ignoreBuildErrors` 영구 fix~~ → **followup `abf5950` 에서 해소** (타입 3곳: CollaborativeEditor synced/awareness cleanup, ExcalidrawEditor 0.18 타입 경로. `tsc --noEmit` 0 + `next build` 통과)
  - keycloak start-dev 인메모리 H2 → 영속 필요 시 외부 DB 연결
- **비고**: 핵심 설계 원칙 = "값만 교체, 코드 불변". 함정 둘 — (1) Next.js 가 `rewrites()`/`NEXT_PUBLIC_*` 를 **빌드타임에** 굳혀 프록시 호스트(`API_HOST`)·WS 주소를 빌드 ARG 로 주입해야 함; (2) **컨테이너 빌드 npm 의 `EAI_AGAIN`** = 사내 프록시 미상속 (긴 진단 끝에 디버그 로그의 `EAI_AGAIN` 으로 확정 — node 버전/메모리/npm ci·install 무관). node20→**node22** 상향(@hocuspocus/server·chevrotain 의 `engines node>=22`). Cycle 40 포트 컨벤션(api PORT == web API_PORT == 3001) 컨테이너에서도 유지.

---

## Cycle 43 (1/2) — 2026-05-21 — ✅ Done (백엔드 OIDC 통합 — 프론트 전환은 2/2)
- **제목**: NestJS Keycloak OIDC 백엔드 통합 (자체 인증에 "입구"만 추가, 공존)
- **카테고리**: 인증 / SSO (Keycloak OIDC) — Cycle 42 컨테이너화 후속
- **커밋**: `313e237`(핵심), 본 CYCLES.md(Docs)
- **변경 파일**:
  - `apps/api/src/auth/oidc.service.ts`(신규) — openid-client v5(CJS) 지연 discovery, authorizationUrl(PKCE/state/nonce), callback(code→token + ID 토큰 검증) → 클레임
  - `apps/api/src/auth/oidc.controller.ts`(신규) — `GET /auth/oidc/login`·`/callback`. tx(state/nonce/verifier)는 단명 httpOnly 쿠키(oidc_tx)로 stateless 전달. 끝에서 기존 `docspace_session` 발급 → `/home`
  - `apps/api/src/auth/oidc.module.ts`(신규) — AuthModule import 해 AuthService 재사용. app.module 에 등록
  - `apps/api/src/auth/auth.service.ts` — `findOrCreateOidcUser`(매핑) + `issueToken` 추가, `login()`에 passwordHash null 가드(추가만, signup/login 로직 유지)
  - `apps/api/prisma/schema.prisma` + 마이그레이션 `20260521090000_oidc_user_fields` — `User.passwordHash` nullable + `keycloakId String? @unique`
  - `apps/api/.env.example` — `KC_ISSUER_URI`(localhost:8080 통일)·`OIDC_REDIRECT_URI`·`OIDC_POST_LOGIN_REDIRECT`
  - `package.json`/`package-lock.json` — openid-client@5.7.1
- **계정 매핑**: `keycloakId(sub)` 우선 → 없으면 `username(preferred_username)`으로 기존 자체계정 링크 → 그래도 없으면 신규 생성(첫 사용자만 ADMIN, SSO 전용이라 passwordHash=null)
- **검증**: 개발용 Keycloak(컨테이너 26.3, realm import) + postgres(컨테이너) + api(호스트) 기동 후 **full OIDC 흐름 프로그램 검증 통과** — testuser/testpass 로 `/auth/oidc/login`→KC 로그인→callback→`docspace_session` 발급→`/auth/me` 가 사용자 반환(신규 생성). 자체 `signup`/`login` 공존 정상(OIDC 전용 사용자 자체 로그인은 401). **jwt.strategy/가드/auth.controller/auth.module 무변경**(git diff로 확인).
- **남은 일 (Cycle 43 2/2)**:
  - Next.js 로그인 화면을 OIDC(`/api/auth/oidc/login`)로 전환 + 회원가입 페이지 처리 + middleware
  - 자체 인증(bcrypt signup/login) 제거 — 현재는 남겨둠(점진적)
  - 컨테이너로 api 운영 시 issuer 호스트(`keycloak:8080` vs 외부) 정합 — `KC_HOSTNAME`/리버스 프록시로 통일
  - AFS 입주: `KC_ISSUER_URI`/`KC_CLIENT_SECRET`만 교체(코드 불변)
- **비고**: 입구만 추가하는 점진·안전 설계 — 자체 JWT 틀(`signToken`/httpOnly 쿠키/passport-jwt/가드) 그대로 재사용, OIDC 는 callback 에서 그 발급 경로에 합류. **issuer 함정**: Keycloak discovery 요청 host 가 곧 토큰 `iss` → 브라우저·api·토큰을 모두 `localhost:8080`로 통일(127.0.0.1 섞으면 iss 불일치). **openid-client v6 은 ESM-only → v5(CJS) 고정**(NestJS CommonJS). 콜백은 realm redirect URI(`localhost:3000/*`)에 맞춰 Next 프록시 경유 → realm 변경 불필요.

---

## Cycle 43 (2/2) — 2026-05-21 — ✅ Done (Cycle 43 완료 — 프론트 OIDC 전환 + 자체 인증 제거)
- **제목**: Next.js 로그인 OIDC 전환 + 자체 인증(bcrypt) 제거
- **카테고리**: 인증 / SSO (Keycloak OIDC) — Cycle 43 (1/2) 마무리
- **커밋**: `29c9093`(핵심), 본 CYCLES.md(Docs)
- **변경 파일**:
  - `apps/web/app/login/page.tsx` — 아이디/비번 폼 → "SSO 로그인" 버튼(`window.location → /api/auth/oidc/login`, top-level 네비게이션). 회원가입 링크 제거
  - `apps/web/app/signup/page.tsx`(삭제) — 자체 회원가입 페이지 제거
  - `apps/web/middleware.ts` — PUBLIC_PATHS 에서 `/signup` 제거(`/login` 만 공개). 쿠키 체크 로직 불변
  - `apps/api/src/auth/auth.controller.ts` — `POST /auth/signup`·`/auth/login` 제거(`/auth/logout`·`GET /auth/me` 유지)
  - `apps/api/src/auth/auth.service.ts` — `signup`/`login`(bcrypt) + bcrypt import 제거(`findById`/`findOrCreateOidcUser`/`issueToken` 유지)
  - `apps/api/src/auth/dto/{login,signup}.dto.ts`(삭제), `apps/api/package.json` — `bcrypt`·`@types/bcrypt` 의존성 제거
- **검증**: 개발용 Keycloak(26.3)+postgres 컨테이너 + 호스트 api/web 기동 후 **프록시 경유(localhost:3000) 전체 SSO 흐름 통과** — `/api/auth/oidc/login`→KC(testuser/testpass)→callback→`docspace_session`→`/api/auth/me` 반환, `/api/auth/logout` 204. **제거 확인**: `POST /api/auth/login`·`/api/auth/signup` 404, `/signup` 페이지 없음(빌드 라우트에서 사라짐; 미인증 접근은 미들웨어가 `/login`으로). api/web 빌드 통과. **jwt.strategy/가드 2개/JwtModule/auth.module/보호 컨트롤러 무변경**(git diff 확인).
- **남은 일**:
  - ~~Keycloak SSO 단일 로그아웃(`end_session_endpoint`)~~ → **followup `ab01c19` 에서 해소** (아래 followup 항목)
  - 운영 DB 기존 자체 사용자 마이그레이션(AFS 입주/실배포 시점) — 자체 사용자는 첫 OIDC 로그인 시 `username` 매칭으로 자동 링크됨
  - 컨테이너로 api 운영 시 issuer 호스트 정합(`KC_HOSTNAME`/리버스 프록시)
- **비고**: 로그인 경로가 OIDC 단일로 통일. 세션 틀(`docspace_session`)·`useAuth`·미들웨어 쿠키 체크는 그대로라 인증 상태 코드는 무변경. Cycle 43 (1/2 백엔드 + 2/2 프론트) **완료**.

---

## Cycle 43 followup — 2026-05-21 — ✅ Done (Keycloak 단일 로그아웃 SLO)
- **제목**: Keycloak 단일 로그아웃(SLO) 연동 — 로그아웃 시 SSO 세션까지 종료
- **카테고리**: 인증 / SSO (Keycloak OIDC) — Cycle 43 잔여 해소
- **커밋**: `ab01c19`(핵심), 본 CYCLES.md(Docs)
- **변경 파일**:
  - `apps/api/src/auth/oidc.service.ts` — `handleCallback` 가 `id_token`(raw)도 반환, `buildEndSessionUrl`(`client.endSessionUrl`: id_token_hint + post_logout_redirect_uri) 추가
  - `apps/api/src/auth/oidc.controller.ts` — callback 에서 `id_token` 을 httpOnly 쿠키 `oidc_id_token` 으로 보관. `GET /auth/oidc/logout` 추가(로컬 쿠키 클리어 → Keycloak end_session 으로 redirect → `/login` 복귀; id_token 없으면 로컬만)
  - `apps/api/src/auth/auth.controller.ts` — `POST /auth/logout` 제거(SLO 의존으로 OidcController 로 이동). `GET /auth/me` 유지
  - `apps/web/components/TopNav.tsx` — 로그아웃 버튼을 fetch → **top-level 네비게이션**(`window.location → /api/auth/oidc/logout`)
  - `apps/api/.env.example` — `OIDC_POST_LOGOUT_REDIRECT`
- **id_token 보관 방식**: 로그인 callback 시 `oidc_id_token` httpOnly 쿠키(JS 접근 불가, maxAge 7d). 로그아웃에서만 읽어 end_session 의 `id_token_hint` 로 사용 → Keycloak 확인 페이지 없이 즉시 SSO 종료.
- **검증**: 프록시 경유 full 흐름 — (로그아웃 전) authz 가 302+code 로 **자동로그인 됨**(SSO 활성) → (로그아웃) `GET /auth/oidc/logout` 이 `openid-connect/logout`(id_token_hint 포함)으로 302 + 두 쿠키 클리어 → end_session 이 `localhost:3000/login` 으로 복귀(확인 페이지 없음) → (로그아웃 후) authz 가 **로그인폼 표시**(자동로그인 안 됨 = 재인증 요구). api build / web tsc 통과. **jwt.strategy/가드 2개/JwtModule/auth.module/보호 컨트롤러 무변경**.
- **남은 일**: 운영 DB 자체 사용자 마이그레이션 / 컨테이너 issuer 호스트 정합 (배포 시점). post_logout_redirect 는 realm `post.logout.redirect.uris`(localhost:3000/*)가 커버 — realm 변경 불필요.
- **비고**: 사내 SSO 표준 — 한 번 로그아웃하면 같은 Keycloak 을 쓰는 서비스 전체에서 로그아웃. **Cycle 43 (1/2 + 2/2 + SLO followup) 최종 완료.**

---

## Cycle 43 followup — 2026-05-21 — ✅ Done (VM 실서버 Keycloak SSO 적용)
- **제목**: VM 실서버(166.79.31.248)에 Cycle 43 Keycloak SSO 적용 + 외부 브라우저 검증
- **카테고리**: 운영 / 배포 / 인증(SSO) — VM 한정 운영 지식 문서화
- **커밋**: 본 Docs 커밋 (코드 변경 없음 — VM 적용은 별도 도구로 사용자와 직접 진행, 그 운영 지식을 docs 에 기록)
- **변경 파일**:
  - `docs/DEPLOY.md` — "3.6 VM Keycloak SSO 적용" 섹션 신규(Docker/containerd 프록시, Keycloak 컨테이너 `KC_HOSTNAME=…/auth`, nginx `/auth` 분기, VM 기준 `.env` OIDC 값, 재배포·검증), 트러블슈팅 행 4개 추가
  - `docs/CYCLES.md` — 본 항목
  - 루트 `docspace-cycle43.bundle` 삭제(git pull 정상화로 불필요)
- **핵심 구성**: 외부 단일 오리진 `http://166.79.31.248:8082`(HAProxy→nginx) 뒤에서 nginx 가 경로 분기 — `/`→Next, `/api`→NestJS, `/auth`→Keycloak. issuer 를 `…:8082/auth/realms/docspace` 로 통일(브라우저·api·토큰 동일 주소) → Cycle 43 issuer 일관성 원칙을 실서버에 적용.
- **검증**: 외부 PC 브라우저 `http://166.79.31.248:8082` → SSO 로그인(testuser) → `/home` ✅, 로그아웃 → 재접속 시 재인증 요구(SLO) ✅.
- **남은 일**: Docker 빌드 시 사내 프록시/CA 주입(배포 환경별), AFS 입주 시 issuer/secret 교체(코드 불변).
- **비고**: 실제 겪은 함정 — (1) Docker 29 는 containerd 가 pull → **containerd 서비스에도 프록시** 필요(dockerd 만으론 TLS handshake timeout); (2) quay.io referrers TLS timeout 은 재시도로 통과; (3) Keycloak issuer 에 `/auth` 누락 방지 위해 `KC_HOSTNAME` 에 경로 포함; (4) `git pull` 프록시 불안정 시 **git bundle 우회**(create→scp→remote set-url→pull→redeploy→URL 복원).

---

## Cycle 42 followup — 2026-05-21 — ✅ Done (Docker 빌드 프록시/CA 통로 + VM 실빌드 검증 완료 2026-05-22)
- **제목**: Docker 이미지 빌드에 사내 프록시/CA 주입 통로 추가 + VM 실빌드 검증 (api·web 이미지 첫 빌드 성공)
- **카테고리**: 운영 / 인프라 / 빌드 — Cycle 42 컨테이너화의 미검증 부분(이미지 실빌드) 해소
- **커밋**: `d5645f8`(핵심 — 프록시/CA 통로), `e5b2c5d`(followup fix — workspace .bin PATH), 본 CYCLES.md(Docs)
- **변경 파일**:
  - `apps/api/Dockerfile`·`apps/web/Dockerfile` — build 스테이지에 `ARG HTTP_PROXY/HTTPS_PROXY/NO_PROXY`(predefined build arg → `npm ci` RUN 에 자동 적용) + 사내 root CA 주입(`COPY ca-certs/` → `update-ca-certificates` → `NODE_EXTRA_CA_CERTS`). ca-certs 비어도 `|| true` 로 안 깨짐
  - `apps/api/Dockerfile`·`apps/web/Dockerfile` (`e5b2c5d`) — `ENV PATH` 에 워크스페이스 `.bin`(`/app/apps/{api,web}/node_modules/.bin`)을 루트 `.bin` 앞에 추가 (prisma/nest/next not found 수정)
  - `docker-compose.yml` — api·web `build.args` 에 `HTTP_PROXY: ${HTTP_PROXY:-}` 등(빌드 호스트 env 에서 전달, 하드코딩 금지)
  - `.gitignore` — `ca-certs/*` 무시 + `!ca-certs/.gitkeep`(사내 CA 비공개). `ca-certs/.gitkeep` 신규
  - `docs/DEPLOY.md` — "사내 프록시 환경에서 빌드" 절차 갱신(ca-certs 배치 → `HTTP_PROXY` export → `docker compose build`)
- **검증**: **VM 166.79.31.248(amadeus-conf, Ubuntu 24.04)에서 실빌드 성공 (2026-05-22).** `ca-certs/` 에 사내 root CA(`SEM_Proxy.crt`) 배치 + `HTTP_PROXY/HTTPS_PROXY/NO_PROXY` export 후 `sudo -E docker compose build api web`. 빌드 컨테이너의 `npm ci` 가 **237초 정상 완료(EAI_AGAIN 없음)** — 이 followup 의 핵심 목표(프록시/CA 주입)가 실제로 작동함을 확인. 첫 빌드는 `prisma: not found`(exit 127)로 실패 → `e5b2c5d` 로 workspace `.bin` PATH 수정 후 재빌드 성공. 이미지 생성: `docspace-api:latest`(2cce58e3bc9d, 1.38GB), `docspace-web:latest`(60d8ee3fd656, 380MB).
- **남은 일**: AFS 입주 시 같은 통로로 그 환경의 프록시/CA 주입(코드 불변).
- **비고**: 이번에 만난 함정 둘 — (1) VM 에 Docker Compose V2 플러그인 미설치 → `sudo apt install docker-compose-v2 docker-buildx`(환경 셋업, 코드 무관); (2) **npm workspaces 워크스페이스 의존성의 bin 위치** — 루트 `node_modules/.bin` 이 아니라 그 워크스페이스(`apps/api`·`apps/web`)의 `node_modules/.bin` 에 링크된다(패키지 본체만 루트로 hoist). 그래서 PATH 에 워크스페이스 `.bin` 을 앞세워야 prisma/nest/next 가 잡힌다. 값(프록시 IP·CA)은 환경 특정이라 repo 미포함 — VM·AFS 동일 메커니즘.

---

## Cycle 42 followup — 2026-05-22 — ✅ Done (VM 컨테이너 런타임 검증)
- **제목**: docker compose 풀스택을 VM에서 실제 기동·검증 (스모크 테스트)
- **카테고리**: 운영 / 인프라 / 배포 — Cycle 42 컨테이너화의 런타임 검증
- **커밋**: `394e328`(api runtime node_modules 누락 fix), `7fe1bb9`(api runtime OpenSSL — node:22-bookworm 전환), 본 CYCLES.md(Docs)
- **변경 파일**:
  - `apps/api/Dockerfile`(`394e328`) — runtime 스테이지에 `COPY apps/api/node_modules` 추가 + CMD `npx prisma`→`node_modules/.bin/prisma`. 루트로 hoist 안 된 의존성(prisma CLI·@prisma/client 등)이 runtime 이미지에 없어 `npx prisma`가 무한 대기하던 것 해소
  - `apps/api/Dockerfile`(`7fe1bb9`) — runtime 베이스 `node:22-bookworm-slim`→`node:22-bookworm`. slim 엔 시스템 OpenSSL(libssl)이 없어 Prisma 엔진이 무한 대기 → full 이미지로
- **검증**: VM(166.79.31.248)에서 라이브 nohup 배포를 잠시 내리고 `docker compose up` → 6개 서비스(postgres·api·web·keycloak·redis·nginx) 전부 Up. NestJS `Nest application successfully started`, `prisma migrate deploy` 통과(api↔postgres 정상), Hocuspocus `:1234` 가동, api/web/nginx HTTP 응답 정상. 검증 후 `compose down` + 라이브 배포 복구 완료.
- **남은 일**: 기능 검증(SSO 로그인·페이지 작성 E2E) — web 을 올바른 `NEXT_PUBLIC_WS_URL` 로 재빌드 + 컨테이너 Keycloak issuer 호스트 정합 필요. AFS 입주용 production 이미지 검증.
- **비고**: 스모크 테스트가 빌드로는 안 드러나는 런타임 결함 2개를 잡음. 함정 — embedded BuildKit 이 데몬 프록시를 base image metadata 해결에 안 써서 직통 연결→타임아웃 → base image 를 `docker pull` 로 먼저 받아 우회.

---

## Cycle 44 — 2026-05-22 — ✅ Done (VM 운영을 docker compose 풀스택으로 전환 + SSO E2E 재검증)
- **제목**: VM 운영 형태 전환 (nohup 라이브 → docker compose 6컨테이너 풀스택) + `:8082` 직접 발행 + 옛 DB 복구
- **카테고리**: 운영 / 배포 / 인프라 — VM 한정 운영 작업 (저장소 코드 변경 없음, 이전 "VM 실서버 SSO 적용"과 같은 성격)
- **커밋**: 본 CYCLES.md(Docs). **코드 변경 없음** — OIDC/nginx 배선은 전부 VM-로컬 비커밋 파일(`docker-compose.override.yml`, `nginx-stack.conf`)로 처리("값만 교체, 코드 불변").
- **변경 파일**:
  - (VM-로컬, 저장소 비커밋) `~/docspace/docker-compose.override.yml` — nginx `8082:80` 발행 + `nginx-stack.conf` 마운트 + `depends_on`(api/web/keycloak); keycloak `KC_HOSTNAME=http://166.79.31.248:8082/auth` + `KC_HTTP_RELATIVE_PATH=/auth` + `KC_PROXY_HEADERS=xforwarded`; api `KC_ISSUER_URI`/`OIDC_REDIRECT_URI`/`OIDC_POST_LOGOUT_REDIRECT` 전부 `:8082/auth` 기준
  - (VM-로컬, 저장소 비커밋) `~/docspace/nginx-stack.conf` — compose 네트워크 기준 경로 분기: `/`→web:3000, `/api`→api:3001(`/api` 프리픽스 제거), `/auth`→keycloak:8080, `/collab`→api:1234(WS). `/etc/nginx/conf.d/default.conf` 로 override 마운트
  - web 이미지 재빌드 — `NEXT_PUBLIC_WS_URL=ws://166.79.31.248:8082/collab` (기존 `ws://…:1234` 에서 변경)
  - `docs/CYCLES.md` — 본 항목
- **검증**: 헬스체크 — 6 컨테이너(web/api/keycloak/postgres/redis/nginx) Up, `nginx -t` 통과, OIDC discovery issuer=`http://166.79.31.248:8082/auth/realms/docspace`, api 컨테이너→`:8082` 도달 확인. **외부 브라우저 E2E 통과** — `:8082` 접속 → SSO 로그인(testuser/testpass) → `/home` → 페이지 작성·저장 → 실시간 협업 2탭 동기화 → 로그아웃 SLO.
- **남은 일**:
  - 편집기 첫 진입 시 "업데이트" 버튼 비활성화 race condition — Cycle 41 백로그의 프론트 버그가 여전히 재현(이번 배포와 무관, 코드 사이클에서 해결 필요).
  - `docker-compose.override.yml` + `nginx-stack.conf` 가 저장소 비커밋 VM-로컬 파일 — AFS 입주/타 환경 이전 시 재작성 필요. 저장소에 템플릿/문서화할지 검토.
  - Keycloak `start-dev` 인메모리 H2 — 재시작 시 realm 재import 로 testuser `sub` 변동.
- **비고**: 운영이 nohup → docker compose 풀스택으로 전환, HAProxy 불필요(compose nginx 가 `:8082` 직접 발행 — 옛 host HAProxy `:8082→:80` 가 inactive 였던 문제 해소). "값만 교체, 코드 불변" 유지(저장소 tracked 파일 무변경, OIDC 배선은 override 만으로). **함정**: 컨테이너 전환 시 DB 가 네이티브 PostgreSQL 16(`/var/lib/postgresql/16/main`)→컨테이너 `docspace_postgres`(볼륨 2026-05-22 01:47) 로 갈려 옛 데이터(8 페이지/4 공간/5 유저)가 안 보였음 — 5432 를 컨테이너에 뺏긴 네이티브 클러스터를 임시 `:5433` 으로 기동→`pg_dump`→컨테이너 DB drop/recreate→통째 복원→api 재기동(entrypoint 의 `prisma migrate deploy` 자동)으로 회수. 백업 보존(VM): `~/docspace-old.sql`, `~/docspace-container-backup-20260522-061915.sql`, 네이티브 postgres 데이터 디렉터리.

---

## Cycle 45 — 2026-05-22 — ✅ Done (배포 도구를 저장소 deploy/ 로 편입)
- **제목**: VM-로컬로만 있던 배포 apparatus(redeploy.sh, nginx 경로 분기 conf, compose override)를 저장소 `deploy/` 로 정식 편입
- **카테고리**: 운영 / 배포 / 인프라 — 배포 도구 버전관리·보존
- **커밋**: `fc1982b`(핵심), 본 CYCLES.md(Docs)
- **변경 파일**:
  - `deploy/redeploy.sh`(신규, `100755`) — 재배포 스크립트: git pull(auto-stash) → DB 백업(`pg_dump`) → 이미지 빌드 → `compose up -d`(api entrypoint 가 `prisma migrate deploy`) → `:8082` 검증. 상단에 환경 특정 블록(`HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`/`NEXT_PUBLIC_WS_URL`) 집약, `--no-build` 옵션
  - `deploy/nginx-stack.conf`(신규) — compose 네트워크 경로 분기(`/`→web:3000, `/api`→api:3001 프리픽스 제거, `/auth`→keycloak:8080, `/collab`→api:1234 WS)
  - `deploy/docker-compose.override.example.yml`(신규) — nginx `8082:80` 발행 + `nginx-stack.conf` 마운트 + OIDC 배선(keycloak `KC_HOSTNAME=…/auth`, api `KC_ISSUER_URI`/`OIDC_*`). 루트로 복사해 사용
  - `.gitignore` — 루트 `/docker-compose.override.yml` 비커밋(환경 특정), 저장소엔 `.example` 템플릿만
  - `docs/DEPLOY.md` — 3.7 의 인라인 override/nginx 템플릿을 `deploy/` 참조로 교체 + 셋업·재배포 절차
- **검증**: 저장소 빌드/실행 검증 아님(파일 편입). `redeploy.sh` 실행권한(`100755`) 확인, 내용은 Cycle 44 에서 검증된 로직 그대로 보존. compose override 는 자동 로드 파일명을 피해 `.example` 로 커밋(루트 override 는 .gitignore).
- **남은 일**: VM 이 이 새 레이아웃(저장소 `deploy/` + 루트 override 복사)을 채택하도록 적용은 별도 단계. AFS 입주 시 `deploy/` 의 환경 블록만 그 환경 값으로 교체.
- **비고**: 원칙 — 배포 도구는 저장소에, 환경 특정 값은 파일 상단에 모아 표시. 이 작업은 개발 PC 저장소만 수정(VM 미변경). `redeploy.sh` 로직은 Cycle 44 검증본이라 그대로 편입(임의 수정 없음).

---

## Cycle 46 — 2026-05-26 — ✅ Done (운영 안정성 강화 7건 — 보안·관측·K8s 준비 선행)
- **제목**: 운영 부채 정리(EOL/obsolete 후속) + DB 비번 강화·정기 백업 + 로그 로테이션 + health 분리 + NODE_ENV·daemon 자동기동
- **카테고리**: 운영 / 인프라 / 보안 — Cycle 47/48(AFS 입주) 선행 정비
- **커밋**: `5f8ef13`(46-1 위생), `cb60637`(46-2 DB 비번), `7fd977f`(46-3 백업), `cba6b14`(46-4 로그), `e2ebc03`(46-5 health), `aa12141`(46-6 NODE_ENV), 본 CYCLES.md(46-7 Docs)
- **변경 파일**:
  - `.gitattributes` 신규 — `* text=auto eol=lf` + 바이너리 명시. CRLF/LF 유령 diff 영구 해소
  - `docker-compose.yml` — postgres `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}` + api `DATABASE_URL` 보간, 정합 보장. `x-default-logging` anchor(10m×5, 6 서비스 일괄)
  - `.env.example`(루트), `apps/api/.env.example` — POSTGRES_PASSWORD 외부화 + `openssl rand -hex 32` 권장(base64 `+/=` 가 URL 파싱 깰 수 있어 hex 채택)
  - `deploy/db-backup.sh`(신규, `100755`) — pg_dump+gzip, 일별 7개·주별 4개(hardlink), 멱등 보존
  - `apps/api/src/health/health.controller.ts` — `/health/live`(즉시 200·DB 미접근) + `/health/ready`(DB 검사, 실패 시 503) 신규, `/health` 호환 유지(deprecation 없음)
  - `apps/api/src/health/health.controller.spec.ts` 신규 — 5 테스트(live·ready 정상·ready 503·compat 정상·compat 503) 통과
  - `apps/api/Dockerfile` runtime — `ENV NODE_ENV=production` (web 정합)
  - `docs/DEPLOY.md` — 3.8 DB 비번 무중단 교체 / 3.9 cron 백업+timezone / 3.10 로그 로테이션 정책 / 3.11 daemon 자동기동 절차
  - `docs/TASKS.md` — obsolete 후속 4건 제거(Task 1 ×3, Task 3 ×1), 신규 Task 5("운영 안정성 강화") 추가, Task 1 의 DB 비번/백업·모니터링 항목은 Task 5 로 이관 완료 처리
- **검증**: `nest build` 통과 / `health.controller.spec.ts` 5 테스트 통과 / `docker compose config` 보간 정합(POSTGRES_PASSWORD 미설정 시 명시 실패) / 6 서비스에 logging anchor 적용 확인 / `bash -n deploy/db-backup.sh` 통과. **실 VM 작업(DB 비번 교체·cron 등록·daemon enable·재부팅 자동기동·로그 회전 실 발생)은 동훈님이 DEPLOY.md 절차대로 수행**, 결과는 사후 본 entry에 반영 또는 별도 followup
- **남은 일**: Cycle 47/48(AFS 입주 준비 — K8s manifest·이미지 크기 최적화). secret manager 도입은 운영 본격화 시점 별도 사이클. Keycloak start-dev 인메모리 H2 영속화는 Cycle 47 후보. 편집기 "업데이트" 버튼 race condition(프론트 코드 사이클)
- **비고**: AFS 입주 둘로 분리 — (a) Keycloak 실연동/issuer·secret 교체는 우리 코드 준비 완료(Cycle 43), AFS 팀 핸드오프 시점 ~5분 작업, (b) K8s manifest/이미지 최적화는 별도 사이클. 항목 5(daemon enable 검증)는 코드 변경 없이 절차만 DEPLOY.md 3.11 에 명시 — VM 실행 결과는 사후 기록. NestJS jest config(`rootDir: src`, `testRegex: \\.spec\\.ts$`)로 health spec 자동 픽업.

---

## Cycle 46 followup — 2026-05-26 — ✅ Done (VM 적용·검증 완료 + 운영 함정 3건)
- **제목**: Cycle 46 VM 적용·검증 완료 + 운영 함정 3건 발견·문서화
- **카테고리**: 운영 / 배포 (Cycle 46 의 VM 실적용 잔여 해소)
- **커밋**: 본 Docs 커밋. **VM 작업 자체는 동훈님이 수행, 저장소 코드 변경 없음** (TASKS.md 상태 플립 + DEPLOY.md 함정 절 추가)
- **변경 파일**:
  - `docs/TASKS.md` — Task 5 상태 🔄 → ✅, "VM 실적용 결과 사후 기록" 후속 제거, "관련 Cycle" `Cycle 46 + 46 followup`, 현재 상태에 VM 검증 완료 사실 추가
  - `docs/DEPLOY.md` — 3.12 신설(재부팅·재배포 운영 함정 a/b/c). 3.11 은 무수정
- **검증 (VM 166.79.31.248, 2026-05-26)**:
  1) DB 비번 강한 값(hex 32) 교체 → `prisma migrate deploy` 통과
  2) cron 매일 03:00 KST 등록, 백업 1회 수동 실행 + 복원 dry-run 통과
  3) 로그 로테이션 6 서비스 일괄 `max-size:10m, max-file:5` 적용 확인
  4) health probe `/live` / `/ready` / `/health` 모두 200
  5) `NODE_ENV=production` 컨테이너 내 확인
  6) docker daemon enabled + 재부팅 후 자동 기동 (함정 a/b/c 해소 후), 외부 `:8082` → 307→SSO 정상
- **남은 일**: 없음 — Cycle 46 영역 완전 종결
- **비고**: 운영 함정 3건 본 사이클에서 최초 발견 — (a) 영구 fix 완료(`systemctl disable`), (b)(c) 절차 문서화로 우회. Cycle 47 후보 "Keycloak `start-dev` → 영속 DB 전환" 에서 (c) 의 nginx 네트워크 fragility 도 함께 검토 권장.

---

## Cycle 47 — 2026-05-26 — ✅ Done (TASKS.md v2 재구조화 — 주제 중심 7 Task)
- **제목**: TASKS.md 를 시간순 retrospective rollup(v1) → 주제(Theme/Epic) 중심 v2 로 전환
- **카테고리**: 프로세스 / 문서 (코드 변경 0)
- **커밋**: 본 Docs 커밋
- **변경 파일**:
  - `docs/TASKS.md` — 전면 재작성. 헤더 갱신 규칙 + Task-level 상태 라벨 5종(🟢/🟡/🔵/⚫/⛔) + 7 Task(A 코어 플랫폼 / B 인증 / C 협업 / D 운영 환경 / E 운영 안정성 / F AFS K8s / G 미구현 기능) + 부록 매핑 표 2개(옛↔새, Cycle↔Task)
  - `.claude/skills/docspace-cycle-rules.md` — 규칙 4 본문에서 "여러 cycle 의 롤업" → "주제 단위 진척 누적", "새 Task 항목이 필요한지" → "**새 주제 emerge 시에만 새 Task**" 로 표현 교체. preview-before-edit·매 cycle 강제 아님·수위 등 다른 절차 무변경
  - `docs/CYCLES.md` — 본 entry
- **검증**: 새 7 Task 골격 렌더 / 닫힘 항목 누락 0 (git log 로 옛 TASKS.md 변경 5건 교차 확인, silently 제거된 4건 모두 Task D ×3 + Task B ×1 닫힘 이력에 명시) / 헤더 갱신 규칙·스킬 규칙 4 새 모델 반영 / CLAUDE.md grep 결과 Task 키워드 1건(docs/ 폴더 설명)뿐이라 추상 수준 무변경
- **남은 일**: 없음 — 본 사이클은 구조 자체. 다음 사이클부터 새 갱신 규칙 적용. 옵션 b(Cycle 1~41 retro-fit) 는 별도 사이클 후보
- **비고**: Task A 마일스톤은 사용자와 협의해 6→7로 분리 — `Cycle 10-1/2` (draft/publish 메커니즘: `Page.draftContent`) 와 `Cycle 35` (draft 노출 규칙: `Page.publishedAt`)는 도입 시점·컨셉이 다른 별도 milestone(CLAUDE.md "알려진 함정"이 가리키는 게 정확히 후자)이라 둘 다 표기. 프론트 도메인 항목("편집기 update 버튼 race")은 v2 미이관 — 동료 트래커 영역.

---

## Cycle 48 — 2026-05-27 — ✅ Done (관리자 페이지 Phase 1)
- **제목**: 관리자 페이지 Phase 1 — 톱니바퀴(ADMIN 한정) + `/admin` (일반 설정 + 사용자 관리) + Keycloak realm role 동기화
- **카테고리**: 인증/권한 + 운영/관리 (신규 영역 — Task H emerge)
- **커밋**: `b831b73`(48-1 schema+migration), `ad40b6b`(48-2 OIDC role 동기화), `944b9b0`(48-3 RolesGuard+Admin BE+spec), `d60c0c9`(48-4 프런트), 본 CYCLES.md(48-5 Docs)
- **변경 파일**:
  - **Prisma** — `User` 확장(email/emailVerified/lastLoginAt), 신규 `AppConfig` single-row(siteName/uploadLimitMb/sessionExpireMin), 마이그레이션 `20260527090000_admin_phase1` (ALTER + CREATE + singleton seed ON CONFLICT)
  - **OIDC** — `handleCallback` 이 `realm_access.roles` + `email_verified` 추출 (옵셔널, scope 누락 안전). `findOrCreateOidcUser` 가 매 로그인마다 `role(admin→ADMIN/else DEVELOPER)` + `email/emailVerified/lastLoginAt` 동기화. **첫 사용자 자동 ADMIN seed 제거** — Keycloak 이 명시적으로 admin realm role 부여해야 함
  - **Auth 가드** — `auth/roles.decorator.ts` (`@Roles('ADMIN',...)` SetMetadata), `auth/roles.guard.ts` (Reflector 기반, JwtAuthGuard 뒤 배치, 실패 시 403)
  - **Admin module** — `admin/admin.{module,controller,service}.ts` + `dto/update-config.dto.ts` (class-validator). 3 라우트(`GET /admin/config`/`PUT /admin/config`/`GET /admin/users`) 모두 `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')`. 사용자 목록은 Keycloak claim 캐시 포함, `passwordHash`/`keycloakId` 미노출, legacy 제외. `app.module.ts` 에 AdminModule 등록
  - **프런트** — `TopNav.AdminGearButton`(`user.role!=='ADMIN'`→`null` DOM 미생성, 클릭 `/admin`). `app/(app)/admin/page.tsx` 클라이언트 가드(비-ADMIN 즉시 `/home` replace) + 좌측 탭. `AdminGeneralSettings.tsx`(폼+SMTP "Phase 2 예정" 비활성 카드). `AdminUsers.tsx`(읽기 전용 테이블 + Keycloak Admin 콘솔 안내·링크 + 역할 변경 안내)
  - **env** — `apps/web/.env.example` 에 `NEXT_PUBLIC_KC_ADMIN_URL`
  - **테스트** — `roles.guard.spec.ts`(5), `admin.service.spec.ts`(3)
- **검증**: `nest build` EXIT 0 (커밋 단계마다), `jest` 8/8 통과(RolesGuard 5 + AdminService 3), `tsc --noEmit` EXIT 0, `next build` `/admin` 5.82kB 라우트 생성. **실 DB 적용**(마이그레이션 `npx prisma migrate deploy`)과 **Keycloak realm role 'admin' 부여/회수 흐름**은 VM/dev 에서 동훈님 확인 — DB `User.role` 토글, ADMIN 사용자 톱니바퀴 노출 + `/admin` 접근, 비-ADMIN 톱니바퀴 미노출 + `/admin` 진입 시 `/home` redirect, 백엔드 API 403
- **남은 일 (Phase 2)**:
  - SMTP 설정 (이메일 발송 — 알림·비밀번호 재설정 등)
  - 추가 운영 도구 (감사 로그·세션 관리 등) — 필요 시점
- **비고**: ADMIN 권한 **source of truth = Keycloak realm role 'admin'**. 매 로그인 동기화 — Keycloak 회수 시 즉시 아닌 다음 로그인부터 반영(쿠키 만료까지 격차 있음, 7d 기본). 이중 가드(프런트 useAuth + 백엔드 RolesGuard) — middleware 는 JWT secret 미접근 원칙 유지. Keycloak admin realm role 부여 절차: 콘솔 → realm `docspace` → Realm roles → Create role `admin` → 해당 사용자 → Role mappings → Assign `admin`. 새 주제(관리자 영역)이 emerge 해 TASKS.md 에 Task H 신규 추가.

---

## Cycle 48 followup — 2026-05-27 — ✅ Done (TopNav 톱니바퀴 드롭다운화)
- **제목**: 관리자 페이지 진입 UX — 톱니바퀴를 단순 진입 버튼 → 드롭다운 트리거로 변경, `/admin` 페이지의 좌측 탭 사이드바 제거(SystemSidebar 와 중복 해소)
- **카테고리**: UX / 관리자 페이지 (Cycle 48 Phase 1 후속)
- **커밋**: `aa06fa3`(core), 본 CYCLES.md(Docs)
- **변경 파일**:
  - `apps/web/components/TopNav.tsx` — `AdminGearButton` 드롭다운화. UserMenu 패턴(`useRef` + `mousedown` 외부 클릭 닫기) 답습 + **Esc 키 닫기 추가**, `aria-haspopup`/`aria-expanded`. 항목 2개("일반 설정"/"사용자 관리") — 각각 `router.push('/admin?tab=...')`
  - `apps/web/app/(app)/admin/page.tsx` — 좌측 TABS `<aside>` 제거(SystemSidebar 와 중복). `useSearchParams()` 로 `?tab` 읽어 초기 탭 결정(없으면 `general`). 페이지 내부 탭 setter 제거 — 전환은 드롭다운에서만. `useSearchParams` Suspense 경계 패턴((app)/layout · login/page 답습)
- **검증**: `tsc --noEmit` EXIT 0, `next build` `/admin` 5.67kB(이전 5.82→감소, 사이드바 코드 제거 효과). 백엔드 spec **13/13 통과**(RolesGuard 5 + AdminService 3 + Health 5 — 회귀 없음). **프론트 컴포넌트 spec 은 `apps/web` 에 jest/vitest 인프라 부재로 미작성** — 인프라 도입은 별도 사이클 분량
- **남은 일**:
  - 프론트 테스트 인프라(jest+RTL 또는 vitest+RTL) 도입 — 별도 사이클 후보. 그 후 AdminGearButton·AdminPage 컴포넌트 spec 보강
  - (Cycle 48 Phase 2) SMTP 설정 — 변동 없음, Task H 백로그 유지
- **비고**: 변경 금지 항목 모두 유지 — 권한 가드(`role!=='ADMIN'`→null DOM 미생성), 라우트 가드(비-ADMIN `/home` replace), 백엔드 `RolesGuard`, `useAuth.ts` DEV ONLY `NEXT_PUBLIC_DEV_FORCE_ADMIN` 블록. 사용자 보고 원인: 기존 단순 진입 → SystemSidebar(스페이스 사이드바) + `/admin` 좌측 메뉴가 동시에 보여 답답함. 드롭다운 + 단일 메인 영역으로 해소.

---

## Cycle 49 — 2026-05-27 — ✅ Done (개인 공간 정식화 — OIDC 자동 생성 + 사이드바 토글 + UserMenu 진입)
- **제목**: 개인 공간(Personal Space) 기능 정식화 — 자동 생성·식별 가능 진입점·사용자 토글
- **카테고리**: 코어 플랫폼 / 사용자 UX (Cycle 32 personal space 의 정식 진입점)
- **커밋**: `d451888`(49-1 schema+migration), `12a438e`(49-2 BE 자동생성+prefs API), `56e514a`(49-3 BE spec), `be0d992`(49-4 FE), 본 CYCLES.md(49-5 Docs)
- **변경 파일**:
  - **Prisma**: `User.showPersonalSpaceInSidebar Boolean @default(false)` + 마이그레이션 `20260527100000_user_pref_personal_space`. **Space 모델 무변경** — 기존 `type=PERSONAL + ownerId`(Cycle 32) 가 식별 필드로 충분, 신규 컬럼 없음
  - **모듈 의존성**: `SpacesModule` 에 `SpacesService` export 추가. `OidcModule` imports 에 `SpacesModule` 추가 (AuthModule↔SpacesModule 순환 회피 — SpacesModule 은 AuthModule 만 import)
  - **OIDC 자동 생성**: `oidc.controller.callback` 의 `findOrCreateOidcUser` 직후 `spacesService.getOrCreatePersonal(user)` 호출. idempotent — 이미 있으면 skip. 실패 시 best-effort(로그만, 로그인 진행)
  - **prefs API**: `AuthService.updateMyPrefs(userId, patch)` + AuthUser·sanitize 에 `showPersonalSpaceInSidebar` 추가 + `UpdatePrefsDto`(class-validator) + `AuthController.PATCH /auth/me/prefs`(JwtAuthGuard)
  - **FE 타입 보강**: `useAuth.AuthUser` 에 prefs 필드 추가(DEV ONLY 블록 무수정). `SpaceWithPages` 에 `type`/`ownerId` 추가(백엔드 이미 반환)
  - **SystemSidebar**: '내 공간' 섹션 헤더 옆 작은 토글("+ 내 공간 추가" / "개인 공간 ✓"). 토글 시 PATCH 호출 + invalidate `['me']`·`['spaces']` 즉시 갱신. 표시 로직: 별표한 공간 ∪ (토글 ON ? 본인 personal space : 없음) dedupe. 접힌·펼친 모드 둘 다 spaces 변수 공유로 자동 반영
  - **TopNav UserMenu**: 정보 블록 다음·로그아웃 위에 "내 개인 공간" 항목. `['spaces']` 캐시에서 본인 personal space → `homePageId` 로 진입. 캐시 미존재 시 `GET /api/spaces/personal` lazy 안전망. 사이드바 토글 상태와 무관 — 항상 진입 가능
  - **spec**: `update-prefs.dto.spec.ts`(4) + `auth.service.spec.ts updateMyPrefs`(2). 전체 6 suites · **20 tests 통과**(회귀 없음)
- **검증**: nest build EXIT 0, jest 20/20, tsc EXIT 0, next build (`/admin` 5.69kB 유지). 실 DB 적용·Keycloak 로그인 시 personal space 자동 생성·prefs 토글·UserMenu 진입 확인은 VM/dev
- **남은 일**: (이번 사이클은 UX/식별 정식화만 — 본 사이클 영역 종결)
- **비고**: **사용자 명시 결정** — 공유/PRIVATE 가드 모델(SpaceMember/SpaceShare/visibility) 일절 추가 안 함. "스페이스 권한 시스템"은 모든 스페이스에 일괄 도입할 별도 사이클. 본 사이클은 순수 UX(자동 생성·진입점·토글). 식별 필드는 신규 컬럼 없이 기존 `type=PERSONAL+ownerId` 활용. **사전 조사에서 발견한 보안 누수**(`GET /pages/search`·`/pages/full-search`·`/pages/recent`·`GET /pages/:id` 의 공간 권한 필터·인증 가드 부재 — 남의 PERSONAL 페이지가 노출됨)는 별도 사이클 후보 — 위 "스페이스 권한 시스템" 사이클에서 일괄 처리 권장. **CLAUDE.md 알려진 함정 재현**: Prisma DLL 잠금(node 프로세스가 query_engine-windows.dll.node 잡음) → 정리 후 generate.

---

## Cycle 50 — 2026-05-27 — ✅ Done (/home 활동 피드 사용자 활동 5종 필터링)
- **제목**: /home UpdatesView 가 시스템 이벤트(삭제/복원/영구삭제·버전·share 토큰 등) 제외, 사용자 활동 5종만 표시
- **카테고리**: UX / 활동 피드 (Cycle 24 ActivityLog 의 표시 계층 필터링)
- **커밋**: `0afa8af`(50-1 BE types IN 필터), `6e08ed2`(50-2 FE /home), `3c390c7`(50-3 BE spec), 본 CYCLES.md(50-4 Docs)
- **변경 파일**:
  - `apps/api/src/activities/activities.service.ts` — `list()` 에 `types?: string[]` 옵션 추가. 비어있지 않으면 `where.type = { in: types }`, 비어있고 단일 `type` 있으면 단일 매칭 폴백(기존 호환), 둘 다 없으면 type 필터 자체 없음. **`types` 가 단일 `type` 보다 우선**
  - `apps/api/src/activities/activities.controller.ts` — `@Query('types')` 추가. 콤마 split + trim + 빈 토큰 제거 후 service 에 배열 전달. 기존 `?type=` 단일 쿼리는 무변경(/activity 호환)
  - `apps/web/app/(app)/home/page.tsx` — `HOME_ACTIVITY_TYPES` 상수(`page.created`/`page.published`/`page.moved`/`page.copied`/`comment.created` — 5종). UpdatesView 의 fetch URL 에 `?types=...` 포함, queryKey 에도 포함되어 캐시 분리 정확
  - `apps/api/src/activities/activities.service.spec.ts` 신규 — 14 케이스(types 단건/다중/빈배열/type 폴백/우선순위/없음 + spaceId·actorName 결합/limit 1~100 clamp/offset 음수→0/orderBy createdAt desc/{items,total} 반환 + log 정상·throw swallow)
- **검증**: jest activities.service.spec **14/14 통과**, nest build EXIT 0 (50-1 단계), tsc + next build EXIT 0 (50-2 단계, `/home` 4.68kB). **/activity 페이지 무영향 확인** — 자체 type 필터 UI 가 단일 `?type=` 사용. `?types=` 미지정 호출은 기존과 동일 응답(회귀 없음)
- **남은 일**: 없음 — 본 사이클은 표시 계층 필터링 한정 (사용자 명시 제약). 추후 활동 카테고리화·구독 등은 별도 사이클 후보
- **비고**: **사용자 명시 제약** — ActivityLog 데이터/스키마 손대지 않음, 새 type enum 추가 금지, 표시 계층(필터링)만. `page.published` 를 "편집/발행" 의미로 사용자 합의 — 첫 발행/재발행이 사실상 콘텐츠 갱신을 의미. /home 만 적용, /activity 의 고급 탐색은 시스템 이벤트도 노출 (감사/관리자 시야 유지). 백엔드 다중 IN 쿼리는 일반 패턴이라 향후 다른 화면에서도 재사용 가능.

---

## Cycle 50 followup — 2026-05-27 — ✅ Done (/home 활동 노출 5종→2종 추가 축소)
- **제목**: 사용자 피드백 — /home 활동 피드에서 page.published / page.moved / page.copied 도 제외, 사용자 생성 행위 2종(page.created + comment.created)만 노출
- **카테고리**: UX / 활동 피드 (Cycle 50 후속 — 노출 범위 미세 조정)
- **커밋**: `8e89a54`(core FE), 본 CYCLES.md(Docs)
- **변경 파일**:
  - `apps/web/app/(app)/home/page.tsx` — `HOME_ACTIVITY_TYPES` 를 5종→2종으로 축소. 주석 갱신(편집/이동/복사 제외 사유 명시). 그 외 무변경
- **검증**: tsc EXIT 0, next build EXIT 0 (`/home` 4.67kB, 직전 4.68→ -1B). 백엔드 무변경(`?types=` 다중 IN 필터는 그대로, 클라이언트가 보내는 목록만 축소). 빌드 산출물의 다른 라우트 크기 변동 없음
- **남은 일**: 없음
- **비고**: Cycle 50 본문의 "사용자 활동 5종" 표현은 followup 시점에 outdated — 본 entry 가 현재 시점의 노출 정책(2종) source of truth. /activity 무영향 (자체 단일 `?type=` 사용). 추가 type 가 향후 필요해지면 `HOME_ACTIVITY_TYPES` 한 줄로 확장 가능. Cycle 50 본 사이클의 5종 합의는 합의 과정의 발자국으로 본문에 그대로 보존(시간순 기록 컨벤션).

---

## Cycle 51 — 2026-05-27 — ✅ Done (스페이스 사이드바 '페이지' → 최근 업데이트 목록)
- **제목**: 스페이스 사이드바 '페이지' 메뉴 클릭 동작 변경 — 첫 페이지 자동 이동 폐기, 그 공간의 최근 업데이트 페이지 목록 화면(SpacePagesView)으로 이동
- **카테고리**: UX / 스페이스 네비게이션
- **커밋**: `d996714`(51-1 BE), `81eb4ce`(51-2 BE spec), `af53f9c`(51-3 FE), 본 CYCLES.md(51-4 Docs)
- **변경 파일**:
  - `apps/api/src/pages/pages.service.ts` — `recent()` 시그니처 `(limit)` → `({ limit?, spaceId?, offset? })`. spaceId 옵셔널(있으면 where 에 추가), offset 0~ clamp, select 에 `author { id, name }` / `lastEditor { id, name }` 추가. 기존 /home 의 `?limit=N` 단일 호출과 100% 호환
  - `apps/api/src/pages/pages.controller.ts` — `@Query('spaceId')`, `@Query('offset')` 추가. service 시그니처에 맞춰 객체 인자 전달
  - `apps/api/src/pages/pages.service.spec.ts` 신규 — 10 케이스(spaceId 필터 / spaceId 미지정 호환 / opts 없이 호출 기본값 / limit 1~50 clamp / offset 음수→0 / orderBy updatedAt desc 고정 / select 필드 / spaceId+offset+limit 결합). draft·휴지통 제외 회귀 가드 포함
  - `apps/web/components/SpacePagesView.tsx` 신규 — 카드 리스트(제목 / 마지막 수정 시각 / 편집자명), '더 보기' 버튼(LIMIT=10, offset += LIMIT), 빈 상태 안내 + '+ 새 페이지' 버튼(TopNav 만들기와 동일 draft 패턴). 페이지 카드 클릭 시 기존 `?pageId=X` 라우팅(PageCard 재사용)
  - `apps/web/components/Sidebar.tsx` — '페이지' NavItem onClick 단순화(`router.push('/?spaceId=' + space.id + '&view=pages')` 한 줄). active 표시 정확화(`pathname === '/' && view === 'pages'`). `useSearchParams` import 추가
  - `apps/web/app/(app)/page.tsx` — `view='pages' && spaceIdFromUrl` 분기 → `<SpacePagesView />` early return. **selectedPageId 도 view=pages 시 null 가드** → loadCurrentPage 호출 / 최근 방문 기록 등 부작용 차단. `/?spaceId=X` 자동 replace effect 에 `!isPagesListView` 가드 추가(URL 회귀 방지)
- **검증**: jest 전체 **8 suites · 44 tests** 통과(기존 34 + 신규 10). nest build EXIT 0 / tsc EXIT 0 / next build EXIT 0 (`/` 432kB, +2kB. 다른 라우트 무변동). 마이그레이션 **없음** (Page/Space/ActivityLog 스키마 무변경)
- **동작 확인 안내** (VM/dev 적용 시):
  1) **마이그레이션 불필요** — 스키마 변경 없음
  2) 스페이스 사이드바 '📄 페이지' 클릭 → URL 이 `/?spaceId=X&view=pages` 로 바뀌고 최근 업데이트 페이지 카드 리스트 표시
  3) 페이지 없는 스페이스에서 클릭 → "이 공간에 아직 페이지가 없습니다" 빈 상태 + '+ 새 페이지' 버튼 (클릭 시 draft 생성·편집 모드 진입)
  4) 페이지 카드 클릭 → `/?pageId=X` 로 이동 (기존 동작)
  5) draft(publishedAt=null) 페이지는 목록에 보이지 않음 — 백엔드 recent() 의 `NOT: { publishedAt: null }` 가드
  6) `/home` 의 "최근 작업" 카드 등 기존 `?limit=N` 단일 호출 회귀 없음
- **남은 일**: 정렬 토글(updatedAt 외 옵션), 작성자/편집자 필터, 무한 스크롤, 페이지별 미리보기 — 모두 본 사이클 범위 외(요구사항 명시). 필요 시 별도 사이클
- **비고**: **라우트 옵션 A 채택** (`/?spaceId=X&view=pages`) — 코드베이스가 dynamic `[id]` 폴더 없이 쿼리 베이스로 일관(Cycle 29 `/home?view=` 패턴 답습)이라 그 라인이 자연스러움. 옵션 B(`/spaces/:id/pages` dynamic route)는 활성 스페이스 컨텍스트 추적 코드 신규 + 컨벤션 깸으로 배제. **페이지네이션 패턴**: '더 보기' 버튼 + offset 누적 — 코드베이스에 무한 스크롤 선례 없고 활동 피드도 단발 limit. 가장 단순한 답습. **초기 limit 10** — 사용자 합의. draft/휴지통 제외는 백엔드가 보장 — CLAUDE.md "draft 페이지 모델" 정책 그대로. 빈 상태 만들기 버튼은 TopNav 만들기와 동일 draft 패턴(중복 추출은 비용 대비 효과 적어 인라인).

---

## Cycle 52 — 2026-05-27 — ✅ Done (페이지 조회 화면 본문 폭 제약 제거)
- **제목**: 페이지 조회 모드의 `max-w-[960px] mx-auto` 폐기 — main 영역 가로 꽉 차게
- **카테고리**: UX / 페이지 레이아웃
- **커밋**: `36d2c57`(52-1 FE), 본 CYCLES.md(52-2 Docs)
- **변경 파일**:
  - `apps/web/app/(app)/page.tsx` (line 489 한 줄): `max-w-[960px] mx-auto px-10 pt-2 pb-16` → `px-8 lg:px-12 xl:px-16 pt-2 pb-16`. 편집 모드(`FullScreenEditor.tsx:221`, Cycle 38 followup `eb30e3d`)와 동일한 반응형 패딩 패턴으로 통일. 사이클 의도 주석 추가
- **검증**: tsc EXIT 0 / next build EXIT 0. 모든 라우트 크기 변동 없음 (`/` 432kB 유지 — CSS 클래스 변경만이라 번들 크기 무영향). 마이그레이션 **없음**
- **동작 확인 안내**:
  1) **마이그레이션 불필요** — CSS 한 줄 변경
  2) 페이지 조회 시 본문이 사이드바·TopNav 사이의 main 영역을 가로로 꽉 채움 (좌우 큰 여백 사라짐)
  3) 양옆 32→48→64px 반응형 패딩 유지 — 텍스트가 가장자리에 닿지 않음
  4) PageHeader / 본문 / 댓글 / WelcomeBanner / 빈 스페이스 안내 모두 같은 wrapper 안이라 동일 폭으로 정렬
  5) 편집(E 키) ↔ 조회 전환 시 폭 jump 없음 — 두 모드가 동일 `px-8 lg:px-12 xl:px-16` 패턴 사용
  6) /home / /admin / /spaces / SpacePagesView 폭 무변동 (회귀 없음, 모두 별도 wrapper)
- **남은 일**: 가독성 토글(max-width 옵션) — 사용자가 긴 줄 가독성을 보강하고 싶을 때 별도 사이클
- **비고**: 단일 라인 변경. 사전 조사에서 `max-w-` grep 으로 폭 제약 위치를 단독 확인 — page.tsx 의 wrapper 만 유일한 폭 제약(PageHeader / PageComments / CollaborativeEditor 모두 자체 폭 제약 없음, 부모 wrapper 폭을 그대로 받음). `mx-auto` 제거가 핵심 — 가운데 정렬이 사용자가 본 "좌우 여백" 의 직접 원인이었음. TOC 사이드 패널(220px 고정 컬럼)은 grid 가 자동 우측 정렬하므로 본문 영역(`minmax(0,1fr)`)이 자연스럽게 넓어짐.

---

## Cycle 53 — 2026-05-27 — ✅ Done (페이지 조회 상단 액션 Confluence 표준 5+1)
- **제목**: 페이지 조회 상단 액션을 Confluence 표준 5개 메인 + ⋯ 더보기로 정리, '나중을 위해 저장' / '지켜보기' 서버 모델 신규, 단축키 E/V/F/W/S 도입
- **카테고리**: UX / 페이지 액션 + 인증 + 데이터 모델
- **커밋**: `d9cafa3`(53-1 Prisma+migration), `1e3fad2`(53-2 BE 모듈), `f555775`(53-3 BE spec), `cacdf16`(53-4 FE), 본 CYCLES.md(53-5 Docs)
- **변경 파일**:
  - **Prisma**: `SavedPage(userId, pageId, createdAt)` + `WatchList(userId, pageId, createdAt)` composite PK. User/Page 양방향 Cascade. 새 마이그레이션 `20260527110000_saves_and_watches` (raw SQL — CREATE TABLE + 인덱스 + FK). 둘을 분리한 이유: 의미 분리(저장 = 개인 책갈피 vs 지켜보기 = 변경 알림 수신자) + 알림 정책 진화 시 watch 만 확장될 수 있음
  - **BE**: `apps/api/src/saves/{module,controller,service,service.spec}.ts` + `apps/api/src/watches/` 동일 구조. `GET/POST/DELETE /pages/:id/save` + `/watch`. JwtAuthGuard 적용(비-로그인 401). 토글은 upsert/deleteMany 로 idempotent. 응답 `{ saved: boolean }` / `{ watching: boolean }`. `app.module.ts` 등록
  - **FE PageHeader.tsx** (전체 재작성):
    - 조회 모드 메인 액션 5개 + ⋯ (편집 E / 인라인 댓글 V / 저장 F / 지켜보기 W / 공유 S / 더보기). `useAuth` + `useQuery`(save/watch 상태) + `useMutation`(토글). queryKey 에 `user.id` 포함 — 사용자 전환 시 자동 분리(보안). `setQueryData` 로 invalidate 없이 즉시 갱신(반응성). 비-로그인 시 저장/지켜보기 disabled + tooltip
    - `ActionButton` 에 `active`(채워진 상태 시각화 — 파란 배경) + `tooltip`(단축키 노출) prop
    - 자체 `keydown` 리스너(V/F/W/S) — 조회 모드일 때만 PageHeader 가 마운트되므로 편집 모드 자연 가드. 입력 포커스 가드(INPUT/TEXTAREA/SELECT/isContentEditable). 케이스 무관(`e.key.toLowerCase()`). 모디파이어(Ctrl/Meta/Alt) 시 skip
    - `useFavoritesStore` import 제거 — PageHeader 만(사이드바/홈은 후속 사이클로 유지)
    - **MoreMenu 재구성**: 추가(이동/복사/히스토리) + 제거(공유 링크 중복) + 유지(Markdown/PDF 내보내기/공간 홈/페이지 삭제)
  - **FE (app)/page.tsx**: `showInlineComments` state(default `true` — 회귀 없음), false 시 `InlineCommentsList` 마운트 안 함(불필요한 fetch 차단). PageHeader 에 `showInlineComments` + `onToggleInlineComments` prop 전달
- **검증**: jest **10 suites · 57 tests** 통과(직전 44 + 신규 13 saves 8 + watches 5 → 정확히는 SavesService 8 + WatchesService 7 = 15). nest build / tsc / next build 모두 EXIT 0. `/` 432kB 유지 — PageHeader 재구성/모듈 추가가 번들 크기에 무영향
- **동작 확인 안내** (VM/dev 적용 시):
  1) **⚠️ 마이그레이션 적용 필수**: `cd apps/api && npx prisma migrate deploy` (SavedPage + WatchList 테이블 생성. Cycle 48·49 에서 반복 누락했던 항목)
  2) 페이지 조회 시 메인 액션 5개(편집 / 인라인 댓글 / 저장 / 지켜보기 / 공유) + ⋯ 가 위 순서대로 노출
  3) 각 버튼 툴팁에 단축키 표시 (예: "편집 (E)", "공유 (S)")
  4) 단축키 E / V / F / W / S 정상 동작 — 편집 모드(FullScreenEditor)·입력 포커스 상태에서는 비활성 (회귀 없음)
  5) ⋯ 더보기 클릭 시: 이동 / 복사 / 히스토리 / Markdown / PDF / 공간 홈 / 페이지 삭제 항목 노출
  6) 상단에서 즐겨찾기(⭐) / 댓글(disabled) / 이동 / 복사 / 히스토리 / 공유 링크 버튼 제거 확인
  7) 페이지 하단 댓글 영역(PageComments) 그대로 노출 (회귀 없음)
  8) "나중을 위해 저장(F)" 토글 동작 — 켜기 → 새로고침 → 켜진 상태 유지(서버 저장 확인)
  9) "지켜보기(W)" 토글 동작 — 동일 검증
  10) 비-로그인 시 저장/지켜보기 버튼 disabled + tooltip "로그인이 필요합니다"
- **남은 일**:
  - 사이드바 ⭐ 즐겨찾기 / `/home` SavedView 를 SavedPage 로 통합 — 사용자 결정 C1 따라 이번 사이클 범위 외(별도 사이클)
  - SavedPage 목록 페이지(저장한 페이지 목록 화면) — 후속 사이클
  - WatchList 기반 알림 발송(현재는 토글만, 알림 SRS FR-100~ 와 연계 별도 사이클)
  - 인라인 댓글 default 정책(현재 `true` — 회귀 없음. Confluence 표준은 default 숨김인데 토글 의미 부여하려면 향후 `false` 검토)
- **비고**: **결정 사항 6개 확정** — A1(InlineCommentsList show/hide) + B(SavedPage 서버 모델) + C1(사이드바/홈 즐겨찾기는 손대지 않음) + D(히스토리 더보기로 이동) + E(공유 링크 MoreMenu 에서 제거) + F(공유 메인 승격). **Windows DLL 잠금**(node 프로세스 10개가 `query_engine-windows.dll.node` 잡음 — CLAUDE.md 함정 그대로 재현) → `Get-Process node | Stop-Process -Force` 후 `prisma generate` 통과. **PageHeader 가 단축키 keydown 을 자체 등록하는 이유**: PageHeader 는 조회 모드에서만 마운트(편집 모드는 FullScreenEditor 가 화면 전체 차지)되므로 편집 모드 자연 가드 + 다른 라우트에서는 발화 X. **Save/Watch queryKey 에 user.id 포함** — 같은 브라우저에서 사용자 전환 시 stale 응답 노출 차단(보안 가드). **setQueryData 즉시 갱신** — invalidate 의 round-trip 없이 클릭 즉시 시각 반영(반응성). MoreMenu '공유 링크' 제거는 메인 '공유 (S)' 와 동일 SharePageDialog 호출 → 중복.

---

## Cycle 54-D — 2026-05-27 — ✅ Done (편집 툴바 '+ 더 많은 내용 삽입' 버튼)
- **제목**: 편집 툴바에 '+ 더 많은 내용 삽입' 버튼 추가 — slash 명령 카탈로그 재활용
- **카테고리**: UX / 편집 툴바 (Cycle 54 sub-cycle D — 메가 사이클 분할)
- **커밋**: `e637d09`(54-D-1 FE), 본 CYCLES.md(54-D-2 Docs)
- **변경 파일**:
  - `apps/web/components/EditorToolbar.tsx` — G5(삽입 그룹) 끝에 InsertMoreButton 신규. `SLASH_ITEMS` / `filterItems` import. popup: 검색 input + 필터 리스트 + ArrowUp/Down/Enter/Esc + 외부 클릭. `item.command({editor, range: 빈 range})` — slash 와 동일 시그니처(빈 range 라 deleteRange 는 no-op, 안전)
- **검증**: tsc EXIT 0 / next build EXIT 0. `/` 432→434kB (+2kB). 다른 라우트 무변동. Yjs 협업 호환 영향 없음 (신규 노드/확장 없음). 마이그레이션 **없음**
- **동작 확인 안내**:
  1) **마이그레이션 불필요** — FE 한 컴포넌트 추가
  2) 편집 모드 진입 → 툴바 G5 끝(인라인 댓글 옆)에 ＋ 버튼 노출
  3) ＋ 클릭 → 검색 input + SLASH_ITEMS 리스트 popup
  4) 검색어 입력 시 title/searchTerms 매칭 필터 (한국어/영어 모두)
  5) ArrowUp/Down + Enter 또는 클릭으로 항목 선택 → 해당 블록(제목/리스트/인용/코드/표/이미지/수식/구분선/링크) 삽입
  6) Esc / 외부 클릭으로 popup 닫기
  7) slash(`/`) 진입 흐름은 그대로 동작 (회귀 없음 — 카탈로그 공유라 항상 동기화)
- **남은 일**: (54-D 영역 종결) — 다음 sub-cycle: 54-A (링크 다이얼로그 탭) → 54-B/C/F → Cycle 55 (멘션 별도)
- **비고**: SlashMenu 컴포넌트 자체는 재활용 못 함 (suggestion render 가 키보드를 외부에 위임하는 forwardRef 구조라 + 버튼 용도엔 부적합). 카탈로그(`SLASH_ITEMS`)만 공유 → 두 진입점이 항상 동기화. Confluence 의 + 버튼이 검색 input 을 포함하는 패턴이라 slash 와 일관된 UX 유지. 사용자 결정: 멘션(E)은 Cycle 55 로 분리, Ctrl+K 는 편집 모드 한정(54-A 에서 구현).

---

## Cycle 54-A — 2026-05-27 — ✅ Done (링크 다이얼로그 탭 UI + Ctrl+K 단축키)
- **제목**: 링크 다이얼로그를 Confluence 표준 탭 UI(연결 문구/웹 연결)로 재구성, 편집 모드 한정 Ctrl+K 단축키 추가
- **카테고리**: UX / 편집 툴바 (Cycle 54 sub-cycle A)
- **커밋**: `12d9616`(54-A-1 FE), 본 CYCLES.md(54-A-2 Docs)
- **변경 파일**:
  - `apps/web/components/InternalPageLinkDialog.tsx` (전체 재작성) — 탭 UI('연결 문구' / '웹 연결'). 기본 탭은 currentHref 가 http(s):// 면 '웹 연결', 그 외(빈 값/내부 경로) '연결 문구'. 외부 URL / 내부 페이지 검색 흐름 자체는 그대로 (회귀 없음). '파일' 탭은 54-C(파일/그림 통합 다이얼로그) 범위라 자리 안내 텍스트만 노출
  - `apps/web/components/EditorToolbar.tsx` LinkButton — `useEffect` 로 Ctrl/Cmd+K keydown 등록(**capture phase + `stopPropagation`**). 가드: `editor.isEditable === true` 일 때만 발동. TopNav 의 글로벌 Ctrl+K(검색 오버레이) 와 분리 — 편집 모드에서만 우리가 먼저 가로채고, 조회 모드/외부 라우트에서는 TopNav 가 그대로 동작. TB title 도 "링크 (Ctrl+K)" 로 갱신
- **검증**: tsc EXIT 0 / next build EXIT 0 (`/` 434kB 유지). Yjs 협업 영향 없음 (TipTap 확장 변경 없음). 마이그레이션 **없음**
- **동작 확인 안내**:
  1) **마이그레이션 불필요** — FE 한 컴포넌트 재작성 + 한 컴포넌트 keydown 추가
  2) 편집 모드 진입 → 본문 안에서 Ctrl+K (또는 Cmd+K) → 링크 다이얼로그 열림
  3) 다이얼로그 상단 탭 2개 — '연결 문구' (기본) / '웹 연결'
  4) 외부 링크 수정 시(currentHref 가 http(s)://) → '웹 연결' 탭 기본 활성
  5) 내부 페이지 검색 → 결과 클릭 시 `/?pageId=X` 마크 적용
  6) 외부 URL Enter 또는 '적용' → 그 URL 로 마크 적용
  7) **조회 모드 / 외부 라우트(/home, /admin)에서 Ctrl+K → TopNav 검색 오버레이 정상 동작** (회귀 없음)
  8) '링크 제거' / '취소' 동작 그대로
- **남은 일**: '파일' 탭(페이지 첨부 파일 연결) — 54-C 에서 통합 다이얼로그와 함께 추가
- **비고**: **Ctrl+K 충돌 해결 전략** — capture phase + `stopPropagation` 으로 편집 모드의 LinkButton 핸들러가 먼저 가로채 TopNav bubble 핸들러 차단. `isEditable` 가드로 조회 모드 자연 분리. 향후 다른 편집 단축키(Ctrl+/, Ctrl+E 등)도 같은 패턴 적용 가능. 탭 UI 의 '파일' 자리 안내 텍스트는 사용자가 Cycle 54-C 적용 전까지 기능을 기다리지 않도록 명시. **Cycle 54 진행 상황**: D(완료) + A(완료) → 남은 sub-cycle: 54-B(표 그리드 8→10) + 54-C(파일/그림 통합 + figcaption) + 54-F(날짜 블록). 멘션(E)은 Cycle 55 메가 사이클로 분리.

---

## Cycle 54-B — 2026-05-27 — ✅ Done (표 그리드 8x8 → 10x10)
- **제목**: TableInsertButton 그리드를 Confluence 표준인 10x10 으로 확장
- **카테고리**: UX / 편집 툴바 (Cycle 54 sub-cycle B)
- **커밋**: `69dde79`(54-B-1 FE), 본 CYCLES.md(54-B-2 Docs)
- **변경 파일**:
  - `apps/web/components/EditorToolbar.tsx` TableInsertButton — `MAX` 상수 8→10. 셀 폭 22px 고정 (`gridTemplateColumns: repeat(MAX, 22px)`)으로 비좁아짐 방지. popup 너비 `w-[210px]` → `w-fit` (콘텐츠가 결정)
- **검증**: tsc + next build EXIT 0 (`/` 434kB 유지 — CSS/상수 변경만이라 번들 무영향). Yjs 협업 영향 없음. 마이그레이션 **없음**
- **동작 확인 안내**:
  1) **마이그레이션 불필요** — CSS/상수 변경만
  2) 편집 모드 → 툴바 ▦ 클릭 → 그리드가 10x10 으로 확장
  3) 셀 hover 시 "N 행 × M 열" 카운트 정상 (최대 10x10)
  4) 11x11 이상은 '직접 입력' 으로 (한도 100x20 유지)
  5) 기존 작은 표 삽입(예: 3x3) 동작 그대로
- **남은 일**: (54-B 영역 종결) — 다음 sub-cycle: 54-F(날짜 블록) / 54-C(파일/그림+캡션)
- **비고**: 1행 변경(MAX 상수) + 2 CSS 클래스 변경. 셀 폭을 1fr→22px 고정으로 바꾼 이유: 1fr 유지 시 popup 너비가 그대로면 10셀이 비좁아 hover 정확도 저하. popup 너비도 w-fit 으로 둬서 8→10 확장이 자연스럽게 표시됨. **Cycle 54 진행 상황**: D + A + B(완료) → 남은 sub-cycle: 54-C(파일/그림+figcaption) + 54-F(날짜 블록). Cycle 55(멘션) 별도.

---

## Cycle 54-F — 2026-05-27 — ✅ Done (날짜 inline atom 노드)
- **제목**: 날짜 inline atom 노드 신규 + slash/＋ 카탈로그에 '날짜' 항목
- **카테고리**: 편집기 / TipTap 확장 (Cycle 54 sub-cycle F)
- **커밋**: `e4dc902`(54-F-1 FE), 본 CYCLES.md(54-F-2 Docs)
- **변경 파일**:
  - `apps/web/lib/tiptap/date.ts` (신규) — DateExtension (`Node.create`). `group: 'inline'`, atom, selectable. attrs.date(ISO `YYYY-MM-DD`). renderHTML `<time datetime data-type='date' class='cf-date-lozenge'>`. parseHTML time[datetime] / time[data-type='date']. NodeView 로 inline 색박스(#deebff/#0747a6) — 클릭 시 prompt 재입력. `promptForDate` 헬퍼 export (형식 검증 + 기본값 오늘). markdown 직렬화는 텍스트만 (`state.write(node.attrs.date)`) — `html: false` 정책상 raw HTML 라운드트립 불가
  - `apps/web/components/CollaborativeEditor.tsx` — extensions 배열에 DateExtension 등록 (MathBlock 다음, 같은 inline atom 카테고리)
  - `apps/web/lib/tiptap/slash-commands.ts` — '날짜' 항목 추가 (구분선 다음). promptForDate → insertContent({ type: 'date', attrs })
- **검증**: tsc + next build EXIT 0 (`/` 434→435kB, +1kB). 마이그레이션 **없음**. Yjs 호환: 신규 노드만 추가 → 안전 (다른 클라이언트도 같은 빌드 받아야 동시 편집)
- **동작 확인 안내**:
  1) **마이그레이션 불필요** — FE 확장만
  2) 편집 모드 → `/` 입력 → '날짜' 항목, 또는 ＋ 버튼 → '날짜' 클릭
  3) prompt 에 ISO 입력(기본값 오늘) → 본문에 색박스 토큰 삽입
  4) 토큰 클릭 → prompt 재입력 → 같은 위치에 갱신
  5) 잘못된 형식(YYYY-MM-DD 아님) 입력 시 alert + 삽입 취소
  6) 다른 사용자(공동 편집) 화면에도 같은 토큰 동기화 (Yjs 호환)
  7) 발행 후 새로고침 시 토큰 시각은 일반 텍스트(`YYYY-MM-DD`)로 보임 — CLAUDE.md "마크다운 직렬화 한계" 동일 범주, 데이터는 보존
- **남은 일**:
  - markdown 라운드트립 보강 (input rule 으로 자동 인식 또는 raw HTML 통로 활성) — followup
  - HTML `<input type="date">` 기반 인라인 picker (현재는 prompt 단순화) — followup
  - locale 표시 (한국어 "2026년 5월 27일" 등) — followup
- **비고**: TipTap inline atom 패턴은 MathInline (Cycle 20) 답습. NodeView 는 React 없이 vanilla dom — 단순한 클릭 핸들러라 ReactNodeViewRenderer 비용 회피. 색박스는 Confluence date lozenge 시각화 모방. 새 type enum / DB 컬럼 없음. **Cycle 54 진행 상황**: D + A + B + F(완료) → 남은 sub-cycle: **54-C** (파일/그림 통합 + figcaption). Cycle 55(멘션) 별도.

---

## Cycle 54-C — 2026-05-27 — ✅ Done (파일/그림 통합 다이얼로그 + figcaption 캡션)
- **제목**: 이미지 삽입을 통합 다이얼로그(탭: 첨부/웹 URL)로 + Image 확장에 figcaption 캡션 도입
- **카테고리**: 편집기 / TipTap 확장 (Cycle 54 sub-cycle C — 가장 큰 sub)
- **커밋**: `461a07a`(54-C-1 다이얼로그), `e4f2689`(54-C-2 캡션 NodeView), 본 CYCLES.md(54-C-3 Docs)
- **변경 파일**:
  - `apps/web/components/ImageInsertDialog.tsx` (신규) — Confluence 표준 탭 2개 ('이 페이지 첨부' / '웹에서의 그림'). 첨부 탭은 GET /pages/:id/attachments 이미지 그리드 + '+ 새 이미지 업로드'(POST 동일 endpoint, AttachmentList 와 같은 `['attachments', pageId]` queryKey 자동 동기화). URL 탭은 입력 + 미리보기(onError 숨김) + 대체 텍스트 입력
  - `apps/web/components/ImageNodeView.tsx` (신규) — `NodeViewWrapper as='figure'`. caption 있으면 figcaption 표시(클릭 시 prompt 편집 → updateAttributes 로 Yjs 자동 전파), 편집 모드에서 빈 캡션은 '캡션 추가...' placeholder, 읽기 모드는 숨김
  - `apps/web/components/CollaborativeEditor.tsx` — Image extension `.extend({ addAttributes, parseHTML, renderHTML, addNodeView })`. caption attr default '' (기존 image 노드 자연 호환). parseHTML 에 `figure.cf-image-figure>img+figcaption` 매칭 추가 + 기존 img 부모 fallback. renderHTML 에 caption 유무로 figure/img 분기 (역호환). addNodeView `ReactNodeViewRenderer(ImageNodeView)`
  - `apps/web/components/EditorToolbar.tsx`:
    - ImageButton: URL prompt → ImageInsertDialog 호출. pageId 는 `usePageStore` 에서 (TaskItemNodeView 와 같은 패턴 — NodeView/툴바가 prop 못 받는 한계 회피용 store)
    - ImageAltButton: 의미 명확화('대체 텍스트(alt) 편집', 🔤). prompt 메시지를 '스크린리더용 짧은 설명' 으로 갱신
    - ImageCaptionButton 신규(📝) — figcaption 편집 분리. NodeView 의 figcaption 클릭과 같은 prompt
- **검증**: tsc + next build EXIT 0 (`/` 435→436kB, +1kB. C-2 단계는 NodeView 흡수로 추가 +0). 마이그레이션 **없음**. Yjs 협업: 신규 attr 옵셔널 default, 신규 노드 없음 → 호환. **단 다른 클라이언트는 새 빌드 받아야 함** (옛 빌드의 schema 와 mismatch 가능)
- **동작 확인 안내**:
  1) **마이그레이션 불필요** — FE 확장만
  2) 편집 모드 → 툴바 🖼️ 클릭 → 새 통합 다이얼로그 열림
  3) '이 페이지 첨부' 탭: 이미지 첨부만 그리드. 카드 클릭 시 즉시 본문에 삽입
  4) '+ 새 이미지 업로드' → 파일 선택 → 업로드 완료 시 자동 삽입 + AttachmentList 도 동기화
  5) '웹에서의 그림' 탭: URL 입력 → 미리보기 → '삽입' 또는 Enter
  6) 삽입된 이미지 아래 figcaption(또는 placeholder) 클릭 → prompt 로 캡션 입력
  7) 편집 모드 ImageCaptionButton(📝) 또는 ImageAltButton(🔤) 으로 분리 편집 가능
  8) 발행 후 새로고침 — figure+figcaption 렌더링 그대로 보존
  9) **회귀 확인**: 기존 caption 없는 image 들은 단순 img 그대로 (renderHTML 분기)
  10) slash '이미지' 는 기존 prompt 방식 유지 — 통합 다이얼로그 진입은 toolbar 만(일관성 followup)
- **남은 일**:
  - slash '이미지' 도 ImageInsertDialog 호출하도록 일관화 (followup — 전역 다이얼로그 trigger 필요)
  - 이미지 크기 조절 핸들 (TipTap 기본 미지원 — `@tiptap/extension-image` 외 별도 패키지 필요)
  - inline figcaption 편집 (prompt 대신 contentEditable) — Yjs 충돌 주의 필요
- **비고**: caption 을 **신규 노드(Figure)가 아닌 Image attr 확장**으로 처리한 이유 — 기존 image 노드와 schema 호환(Yjs migration 0). parseHTML 의 figure 매칭이 먼저, 그 다음 부모 img fallback 으로 paste 호환성. renderHTML 도 caption 유무로 분기해 역호환. ImageNodeView 의 figcaption 편집은 prompt 로 단순화 — Yjs `Y.Doc` 안의 caption attr 가 attribute transaction 으로 전파되어 다른 클라이언트 즉시 동기. **Cycle 54 완료**: D + A + B + F + C → 모두 종료. **Cycle 55(멘션)** 는 별도 메가 사이클(BE users 검색 + Mention extension + suggestion 통합 + 향후 알림 분기점).

---

## Cycle 56 — 2026-05-27 — ✅ Done (페이지 삭제 cascade 옵션 + 라우팅 fix)
- **제목**: 페이지 삭제 동작 분리 — 기본은 자식 승격(단일), `cascade=true` 만 자손 휴지통. window.confirm → DeletePageDialog(체크박스). 삭제 후 같은 공간 유지(라우팅 버그 fix)
- **카테고리**: 코어 플랫폼 / UX 버그 fix (사용자 보고 — Cycle 55 자리 건너뛰고 시급 fix)
- **커밋**: `d9e3bd1`(56-1 BE), `9cc6c21`(56-2 BE spec), `5e46dca`(56-3 FE), 본 CYCLES.md(56-4 Docs)
- **사용자 보고 원인 분석**:
  1) 사용자 의도("딱 페이지만 삭제")와 시스템 동작(cascade — Cycle 18-1a)이 불일치
  2) `router.push('/')` 가 첫 스페이스 fallback 으로 가서 **다른 공간으로 이동**
  3) "트리에서 하위만 사라짐" 보고는 cache invalidate timing 의심 (백엔드는 cascade 정상 동작)
- **변경 파일**:
  - `apps/api/src/pages/pages.service.ts` `remove(id, opts.cascade, actor)` — cascade=true → 자손 모두 휴지통(기존 Cycle 18-1a 동작). cascade=false(기본) → `$transaction(자식 parentId → 부모 parentId 승격, 부모만 deletedAt)`. 자식 없으면 옵션 무관. activity payload 에 `promotedChildren` / `descendants` 카운트 (서로 배타)
  - `apps/api/src/pages/pages.controller.ts` `@Query('cascade')` 추가 (`?cascade=true` 만 cascade)
  - `apps/api/src/pages/pages.service.spec.ts` — remove **9 케이스 신규** (자식 0/N · cascade on/off · parent root · opts 없이 · BadRequest/NotFound · actor=null · activity payload). PrismaService mock 확장
  - `apps/web/components/DeletePageDialog.tsx` 신규 — 체크박스 다이얼로그(자식 N 일 때만 노출), 열릴 때마다 cascade 체크 초기화
  - `apps/web/components/Sidebar.tsx` — × 버튼 `window.confirm` 제거. 단일 DeletePageDialog 마운트. Row 컴포넌트 prop `onDeletePage` → `onRequestDelete(item)` 의도 명확화. 활성 자식 카운트는 `pages.filter(p.parentId === item.id)`. `onDeletePage` (layout 전달) 시그니처 `(pageId, cascade)`
  - `apps/web/app/(app)/layout.tsx` `handleDeletePage(pageId, cascade)` — fetch URL 에 `?cascade=true` 조건부 추가. **라우팅 fix**: 삭제 전 부모/홈 미리 결정 → fallback 우선순위 부모 → 홈 → 빈 공간 진입(`/?spaceId=X`) → `/` (다른 공간 fallback 차단)
  - `apps/web/app/(app)/page.tsx` `handleDeleteCurrentPage(pageId, cascade)` — 같은 패턴. `confirmDeleteCurrent` 가 DeletePageDialog 트리거. `currentChildCount` useMemo
- **검증**: jest **10 suites · 66 tests** 통과(직전 57 + 신규 9 = 66). nest build / tsc / next build 모두 EXIT 0 (`/` 436→435kB, -1kB — confirm 코드 제거 + 다이얼로그 추가 상쇄). 마이그레이션 **없음** (스키마 무변경)
- **동작 확인 안내** (VM/dev 적용 시):
  1) **마이그레이션 불필요** — Page 스키마 무변경
  2) 하위 페이지가 있는 부모를 사이드바 × 또는 PageHeader ⋯ → '페이지 삭제'
  3) **다이얼로그**: "{title}을(를) 삭제합니다. N개의 하위 페이지가 페이지 트리에 남습니다 (한 단계 위로 승격)" + 체크박스 "하위 페이지도 삭제"
  4) **체크 해제(기본)** + 삭제 → 부모만 휴지통, 자식들 한 단계 위로 승격(페이지 트리에 그대로 남음)
  5) 체크 + 삭제 → 자손 모두 휴지통 (기존 Cycle 18-1a 동작, ?cascade=true)
  6) 자식 없는 페이지 삭제 → 체크박스 안 보임, 단순 안내
  7) **삭제 후 같은 공간 유지** — 부모 → 홈 → 빈 공간 진입 순으로 fallback. **다른 공간으로 이동하지 않음** (사용자 보고 버그 fix 검증)
  8) 휴지통(🗑️) 에서 cascade=true 였던 자손도 그대로 복구 가능 (Cycle 18-1a restore 로직 영향 없음)
- **남은 일**: cascade=true 의 restore 가 자손도 일관되게 살아나는지 별도 검증 권장(현재 코드 그대로 동작 예상)
- **비고**: **자식 승격 시 position 은 그대로 유지** — 같은 (spaceId, parentId) 그룹에 다른 형제와 중복 가능하나 정렬 안정. position 재부여는 Cycle 19a 의 reorder 기능 외부에서. **cascade=true 동작은 기존과 100% 호환** — Cycle 18-1a 의 자손 휴지통 보존(restore 호환). **라우팅 fix 메커니즘**: 삭제 전 `activeSpace.pages` 에서 부모 ID 추출(삭제 후엔 invalidate 로 사라짐). 부모 없으면 `homePageId` → 그것도 없으면 빈 공간 진입 → 최후 `/`. **Cycle 55(멘션)는 미시작** — 사용자 보고 시급 fix 가 우선이라 56 으로 번호 점프. 향후 멘션 사이클이 55 로 들어옴.

---

## Cycle 56 followup — 2026-05-27 — ✅ Done (DeletePageDialog 문구 간소화)
- **제목**: 사용자 피드백 — 다이얼로그 부연 설명 제거(간결화)
- **카테고리**: UX / 페이지 삭제 (Cycle 56 후속)
- **커밋**: `f7391ad`(core FE), 본 CYCLES.md(Docs)
- **변경 파일**:
  - `apps/web/components/DeletePageDialog.tsx` — "(한 단계 위로 승격)" 제거 → `${N}개의 하위 페이지가 페이지 트리에 남습니다.` 만 노출. 체크박스 부연 설명("직접 하위 페이지 + 그 아래 모든 자손") span 제거. 라벨만 '하위 페이지도 삭제'. 정렬도 items-start → items-center
- **검증**: tsc EXIT 0. **동작 변경 없음** — 메시지만 갱신
- **남은 일**: 없음
- **비고**: 사용자가 동작 확인 후 "군더더기 문구 제거" 요청 — 다이얼로그 의미가 이미 cascade 체크박스로 전달되므로 부연 설명 불필요. 단순화로 인지 부담 ↓.

---

## Cycle 55 — 2026-05-27 — ✅ Done (@user 멘션 도입)
- **제목**: TipTap @user 멘션 노드 신규 + GET /users 검색 필터 + suggestion popup
- **카테고리**: 편집기 / 협업 (SRS FR-072 멘션 — 알림 발송은 별도 사이클)
- **커밋**: `bc10c8d`(55-1 BE users 검색), `d50c497`(55-2 BE spec), `fb01ce3`(55-3 FE mention), 본 CYCLES.md(55-4 Docs)
- **변경 파일**:
  - `apps/api/src/users/users.service.ts` — `findAll({ q? })` OR(name, username) insensitive contains. trim 후 빈 값 무시. 기존 호출(q 미지정) 100% 호환
  - `apps/api/src/users/users.controller.ts` — `@Query('q')` 추가
  - `apps/api/src/users/users.service.spec.ts` 신규 — 6 케이스 (q 없음/있음/빈 문자열/whitespace/양옆 공백 trim/select 보안 가드 — passwordHash·keycloakId·email 미노출 회귀 가드)
  - `apps/web/lib/tiptap/mention.ts` 신규 — MentionNode (Node.create, inline atom, attrs.id/label) + Suggestion plugin (char '@', GET /api/users?q= fetch, tippy popup). **`@tiptap/extension-mention` 패키지 충돌**(peer mismatch — core 2.x vs suggestion 3.x)로 자체 구현 — `slash-command.ts` 와 동일 패턴이라 유지보수 부담 ↓
  - `apps/web/components/MentionSuggestionPopup.tsx` 신규 — SlashMenu 패턴 forwardRef + useImperativeHandle. 아바타(이름 첫글자) + name + department 표시. ArrowUp/Down + Enter 키보드 nav
  - `apps/web/components/CollaborativeEditor.tsx` — extensions 에 MentionNode 등록 (DateExtension 다음, 같은 inline atom 카테고리)
- **검증**: jest **11 suites · 72 tests** 통과(직전 66 + 신규 6). nest build / tsc / next build EXIT 0 (`/` 435→437kB, +2kB Mention + popup). 마이그레이션 **없음**. Yjs 호환: 신규 노드만 추가 → 안전 (배포 후 모든 클라이언트 새 빌드 받아야 동시 편집)
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 편집 모드 → 본문에서 `@` 입력 → suggestion popup 자동 표시 (전체 사용자)
  3) 이름 일부 타이핑(예: `@홍`) → `/api/users?q=홍` fetch → 일치 사용자 리스트
  4) ArrowUp/Down + Enter 또는 마우스 클릭 → **멘션 토큰(@name) 삽입 + 공백 자동**
  5) 토큰은 파란 색박스 inline (`#deebff` / `#0747a6`) — Confluence mention lozenge 스타일
  6) Esc / 외부 클릭 / 빈 결과 popup → '일치하는 사용자가 없습니다'
  7) 다른 사용자(공동 편집) 화면에도 같은 토큰 동기화 (Yjs 호환)
  8) 발행 후 새로고침 시 토큰 그대로 (parseHTML `span.cf-mention[data-id]` 매칭)
  9) markdown 직렬화는 `@name` 텍스트만 (Markdown export 시 노드 시각화 손실 — CLAUDE.md 한계 동일 범주)
- **남은 일**:
  - **알림(Notification) 발송** — 멘션 transaction hook → POST /notifications (별도 메가 사이클, FR-100 ~ FR-102 연계)
  - markdown 라운드트립 보강 (input rule 또는 raw HTML 통로)
  - 멘션 토큰 클릭 → 프로필/페이지 진입 (Notification UX 와 함께)
- **비고**: **`@tiptap/extension-mention` 사용 불가**: `@tiptap/suggestion` 3.x vs `@tiptap/core` 2.x peer mismatch. extension-mention 2.x 도 같은 충돌. 자체 Node + Suggestion 직접 구현으로 우회 — `slash-command.ts` 와 정확히 같은 패턴 답습이라 유지보수 부담 ↓. clientRect 타입에 `undefined` 허용 필요(strict 모드 미세 차이). **알림 분기점**: MentionNode 의 Suggestion command 콜백에서 `props.id` 알 수 있으므로 POST /notifications 호출이 자연스러운 연결지점. 알림 모델(Notification) 도입은 별도 메가 사이클(권장 Cycle 57). **번호 메모**: Cycle 55 자리가 비어 있었음(56 이 시급 fix 로 먼저). 멘션 도입으로 55 자리 채움.

---

## Cycle 55 followup 1~5 — 2026-05-27 — 멘션 클릭 라우팅 + 라운드트립 시도들

순차적 fix 시도 5 차례. 자세히는 commit 메시지(`d6df56c`, `e2e3264`, `59b8ad0`, `a6430eb`, `48ca1cf`):
- **followup 1** (`d6df56c`): 멘션 클릭 → 그 사용자의 personal space 라우팅 (Cycle 49 활용). Cycle 58 에서 프로파일 페이지로 라우팅 변경됨
- **followup 2** (`e2e3264`): markdown 라운드트립 시도 — `@[label](mention:id)` markup + inline ruler. 실패 (ruler 등록 안 됨)
- **followup 3** (`59b8ad0`): raw HTML serialize + `Markdown.configure({html:true})`. 실패 + **편집 본문 누적 회귀**
- **followup 4** (`a6430eb`): parseHTML 너그럽게(3-단계). 실패
- **followup 5** (`48ca1cf`) **긴급 rollback**: html:true / raw HTML serialize 모두 되돌림. 데이터 손상 회피. 멘션 라운드트립은 일시 포기 → Cycle 57 에서 근본 해결.
- **교훈**: `tiptap-markdown` 의 사용자 정의 노드/마크 라운드트립 한계는 부분 fix 로 안 됨. content 저장 방식 자체 전환(JSON) 필요 → Cycle 57.

---

## Cycle 57 — 2026-05-27 — ✅ Done (content 저장 markdown → ProseMirror JSON 전환)
- **제목**: 사용자 정의 노드/마크 라운드트립 한계 근본 해결 — content 저장 방식을 markdown → ProseMirror JSON 으로 전환
- **카테고리**: 편집기 / 데이터 저장 (CLAUDE.md '마크다운 직렬화 한계' 카테고리 해소)
- **커밋**: `e11fdab`(57-1 FE), 본 CYCLES.md(57-2/3 Docs — 검증은 사용자 동작 확인으로 완료)
- **방식**:
  - 자동저장: `editor.storage.markdown.getMarkdown()` → `editor.getJSON()` + `JSON.stringify`
  - 발행: FullScreenEditor 의 publish 도 같은 패턴
  - 로드: `parseContent(raw)` — content 가 `{` 으로 시작하면 `JSON.parse`, 그 외엔 markdown 문자열 그대로
  - tiptap-markdown 의 `MarkdownParser.parse(object)` 가 object 면 그대로 반환 → setContent 호출 시 ProseMirror 가 JSON 으로 직접 시드 (자연 우회)
- **변경 파일**:
  - `apps/web/components/CollaborativeEditor.tsx` — `parseContent` 헬퍼, useEditor 의 content prop, Yjs 시드, 자동저장 onUpdate (4 곳)
  - `apps/web/components/FullScreenEditor.tsx` — publish 직전 markdown 추출 → JSON 직렬화
  - `CLAUDE.md` — '마크다운 직렬화 한계' 항목을 Cycle 57 해결 표시(취소선)로 갱신
- **검증**: tsc + next build EXIT 0 (`/` 437kB 유지). **사용자 동작 확인 완료** — 새 멘션 발행 후 새로고침 시 토큰 색박스 그대로 유지
- **호환**:
  - 옛 markdown 페이지: `parseContent` 가 `{` 아니라서 markdown 으로 처리 (기존 흐름). 다음 편집/자동저장 시 JSON 으로 자연 마이그레이션
  - MoreMenu '내보내기': `editor.storage.markdown.getMarkdown()` 그대로 동작 → 일방향 markdown 변환 정상
  - Markdown.configure html: false 유지
- **동작 확인 안내**:
  1) 마이그레이션 불필요 (스키마 무변경)
  2) 새 페이지에서 `@` 멘션 → 발행 → 새로고침 → 토큰 그대로 (색박스)
  3) 이미지 figcaption / 색상 / 하이라이트 등 다른 라운드트립도 함께 해결됨
  4) 옛 markdown 페이지 → 정상 표시 (호환), 편집 시 JSON 으로 마이그레이션
  5) MoreMenu Markdown 내보내기 동작 정상
- **남은 일**: (없음) — CLAUDE.md '마크다운 직렬화 한계' 카테고리 종결
- **비고**: **시도 이력**: Cycle 55 followup 1~4 의 markdown 기반 우회 모두 실패. followup 5 긴급 rollback 후 근본 접근. 사전 조사에서 tiptap-markdown 의 `Markdown.setContent` override 가 모든 string 을 markdown parse 로 가로채는 것 + `MarkdownParser.parse(object)` 는 그대로 반환되는 것 확인 → JSON 방식 채택. **부수효과**: Yjs 호환 영향 없음 (Yjs Y.Doc 이 source of truth, DB content 는 시드/발행 결과만). copy-paste 의 markdown clipboard 도 `MarkdownClipboard` extension 그대로 → 무영향. **sentinel(HTML) 방식 배제**: setContent 의 가로채기 우회가 복잡 + html:true 가 부수효과 (followup 3 의 누적 회귀).

---

## Cycle 58 — 2026-05-27 — ✅ Done (사용자 프로파일 페이지 + 편집 모드 멘션 popover)
- **제목**: 멘션 클릭 라우팅 정식화 — 조회 모드는 사용자 프로파일 페이지(`?profileId=`), 편집 모드는 컨텍스트 popover(연결로 이동/편집/연결해제)
- **카테고리**: UX / 사용자 / 활동 (Cycle 55 멘션 후속)
- **커밋**: `9802ec6`(58-1 BE), `18dba5e`(58-2 BE spec), `a9906b8`(58-3 FE 프로파일), `fe0244a`(58-4 FE popover), 본 CYCLES.md(58-5 Docs)
- **변경 파일**:
  - `apps/api/src/users/users.service.ts` — `findOne(id)` 신규. id+username+name+department+role+createdAt 반환. legacy 차단(NotFound). passwordHash/keycloakId/email 미노출
  - `apps/api/src/users/users.controller.ts` — `GET /users/:id` 추가 (JwtAuthGuard)
  - `apps/api/src/activities/activities.service.ts` — `opts.actorId` 추가 (단일 actorId AND 필터). 프로파일 활동 피드용
  - `apps/api/src/activities/activities.controller.ts` — `@Query('actorId')` 추가
  - `apps/api/src/users/users.service.spec.ts` + `apps/api/src/activities/activities.service.spec.ts` — 8 케이스 신규 (UsersService.findOne 4 + ActivitiesService.list actorId 4)
  - `apps/web/components/ProfileView.tsx` 신규 — 사용자 정보 카드(아바타 + name + department + role + @username + 가입일) + 활동 피드(GET /activities?actorId=&limit=50). `formatActivity` 재활용 + PageCard 재활용
  - `apps/web/app/(app)/page.tsx` — `profileIdFromUrl` / `isProfileView` 분기 (view=pages 패턴 답습). selectedPageId 가드 + replace effect 가드. 멘션 클릭 라우팅 personal space → `/?profileId=X`. 편집 모드 본문 click handler 에 `isBodyEditable` 분기 → popover state
  - `apps/web/components/MentionEditPopover.tsx` 신규 — floating menu (position: fixed). 3 항목: 🔗 연결로 이동 / ✏️ 편집 / ✕ 연결해제. 외부 click + Esc 로 닫기
- **검증**: jest **11 suites · 80 tests** 통과(직전 72 + 신규 8). tsc + next build EXIT 0 (`/` 437kB 유지). 마이그레이션 **없음**
- **동작 확인 안내**:
  1) 마이그레이션 불필요
  2) 조회 모드 → 멘션 토큰 클릭 → `/?profileId=X` → 정보 카드 + 활동 피드
  3) 편집 모드 → 멘션 토큰 클릭 → popover 3 항목
  4) '연결로 이동' → 새 창에서 프로파일 (편집 중 같은 창 이동 X)
  5) '편집' → 멘션 노드 삭제 + `@` 텍스트 insert → suggestion 자동 트리거 → 사용자 재선택
  6) '연결해제' → 멘션 노드만 삭제 (텍스트도 사라짐)
  7) popover 외부 click 또는 Esc 로 닫기
- **남은 일**:
  - 알림(Notification) — 멘션 transaction hook → POST /notifications 별도 메가 사이클
  - 자기 자신 멘션 시 self-profile 동작 (현재는 그대로 자기 프로파일)
- **비고**: 라우트 옵션 A 채택(`/?profileId=X`) — `view=pages` 와 같은 (app)/page.tsx 분기 패턴, layout 변경 X. ProfileView 내부 fetch 2 개 (user + activities). 편집 모드 popover 는 fixed position + getBoundingClientRect — Yjs 협업 영향 없음. '편집' 동작은 단순 노드 삭제 + '@' 텍스트 insert → suggestion 자동 트리거 (인기 패턴). Cycle 58 종결 — 멘션 기능 완성.

---

## Cycle 59 — 2026-05-27 — ✅ Done (멘션 알림 — Notification 모델 + 종 아이콘)
- **제목**: 멘션 시 수신자에게 알림 트리거 + TopNav 종 아이콘 + dropdown 패널
- **카테고리**: 코어 플랫폼 / 알림 인프라 (SRS FR-100~, Cycle 55/58 멘션 후속)
- **커밋**: `28e2ff7`(59-1 Prisma+migration), `616177c`(59-2 BE service+controller), `1eb4acb`(59-3 publish 트리거), `c017826`(59-4 BE spec), `33bf3dd`(59-5 FE), 본 CYCLES.md(59-6 Docs)
- **변경 파일**:
  - **Prisma**: `Notification(id, recipientId, actorId, type, pageId, payload, readAt, createdAt)`. `@@unique([recipientId, actorId, pageId, type])` dedupe. 인덱스 `(recipientId, readAt)` 미읽 조회. recipient Cascade / actor SetNull / page SetNull (사용자·페이지 삭제 후에도 알림 보존). 신규 마이그레이션 `20260527120000_notifications`
  - **BE**: `apps/api/src/notifications/{module,service,controller}.ts` 신규. `notifyMentions({actorId, pageId, recipientUserIds, payload})` — 자기 자신 + 중복 dedupe + upsert (재발행 시 noop, 스팸 방지) + best-effort try/catch. `listForUser(userId, {limit})` — 최근 limit + unreadCount. `markRead` / `markAllRead` — updateMany 본인 가드 idempotent. 모든 라우트 JwtAuthGuard. app.module 등록
  - **BE 트리거**: `apps/api/src/pages/pages.service.ts` publish() 직후 `extractMentionIds(published.content)` → `notifications.notifyMentions(...)`. PagesModule 에 NotificationsModule import. best-effort (try/catch). extractMentionIds 헬퍼는 export — ProseMirror JSON 안 mention 노드 traverse, 옛 markdown 은 빈 배열 (자연 skip)
  - **BE spec**: `notifications.service.spec.ts` 12 케이스 + `extract-mention-ids.spec.ts` 9 케이스. pages.service.spec 의 두 module 빌더에 NotificationsService mock 추가 (회귀 fix)
  - **FE**: `apps/web/components/NotificationBellButton.tsx` 신규 — AdminGearButton 패턴 답습(useRef + mousedown + Esc). 비-로그인 시 DOM 미생성. `useQuery (['notifications', user.id])` staleTime 30s + `refetchInterval 60_000` polling. unreadCount badge (빨강, 99+ clamp). dropdown 패널: 알림 리스트(미읽 dot + actor + page) + '모두 읽음'. 알림 클릭 → 읽음 mark + 페이지(`?pageId=`) 또는 actor 프로파일(`?profileId=`) 라우팅. 페이지 deletedAt 면 프로파일 fallback. TopNav 의 AdminGearButton 앞에 삽입
- **검증**: jest **13 suites · 97 tests** 통과(직전 80 + 신규 17). nest build / tsc / next build 모두 EXIT 0. 마이그레이션 동반 — `Notification` 테이블 신규
- **동작 확인 안내**:
  1) **⚠️ 마이그레이션 적용 필수**: `cd apps/api && npx prisma migrate deploy` (`Notification` 테이블 생성, 인덱스 4 개 포함)
  2) 사용자 A 가 편집 모드에서 사용자 B `@홍길동` 멘션 → 발행 → 사용자 B 의 TopNav 종 아이콘에 빨간 badge "1"
  3) 종 클릭 → dropdown "A님이 '제목'에서 회원님을 언급했습니다 · n분 전"
  4) 알림 클릭 → 그 페이지 진입 + 자동 읽음 처리(badge -1)
  5) "모두 읽음" 클릭 → badge 사라짐
  6) **dedupe**: 같은 페이지에 사용자 B 를 여러 번 멘션해도 알림 1개
  7) **자기 자신 멘션** → 알림 X (skip)
  8) 페이지 삭제(soft delete) 후 알림 클릭 → 그 사용자 프로파일로 fallback
  9) 옛 markdown 페이지 발행 — 멘션 노드 없으니 알림 트리거 X (자연 skip)
  10) 비-로그인 화면(/login 등) — TopNav 종 아이콘 DOM 미생성
- **남은 일**:
  - 알림 종류 확장 (comment.reply, page.commented, watch 변경 등) — 별도 사이클. type enum 그대로 확장
  - 이메일 알림 (SMTP, FR-102) — Cycle 48 Phase 2 영역
  - WebSocket / SSE 실시간 push (현재 60초 polling — 작은 팀 규모 충분)
- **비고**: **dedupe 키**: `@@unique([recipientId, actorId, pageId, type])` — 한 발행에 같은 사용자 여러 번 멘션해도 알림 1개. 재발행 시에도 upsert noop → 같은 멘션이 계속 새 알림으로 spam 안 됨 (의도). 재알림 원하면 `update: { readAt: null, createdAt: new Date() }` 로 변경 가능. **publish best-effort**: 알림 실패가 발행 본체 깨뜨리지 않음. extractMentionIds 가 '{' 시작 아니면 빈 배열 → 옛 markdown 안전 skip. **polling 60초**: WebSocket/SSE 도입은 별도 사이클 (사내 규모면 polling 충분). **테이블 인덱스**: dedupe unique 외에 (recipientId, readAt) + (recipientId, createdAt) — 미읽 조회와 최근순 조회 모두 가속.

---

## Cycle 60 — 2026-05-27 — ✅ Done (댓글/답글 알림)
- **제목**: 알림 종류 확장 — `comment.created` (내 페이지에 댓글) + `comment.reply` (내 댓글에 답글). Notification 모델 재활용, 마이그레이션 없음
- **카테고리**: 알림 (Cycle 59 후속)
- **커밋**: `30dcd81`(60-1 BE), `5c4399c`(60-2 spec), `2a81f11`(60-3 FE), 본 CYCLES.md(60-4 Docs)
- **변경 파일**:
  - `apps/api/src/notifications/notifications.service.ts` — `NotificationType` 확장 (mention / comment.created / comment.reply). `notifyOne(params)` 단일 recipient 일반 알림 — notifyMentions 와 같은 upsert dedupe + 자기 자신 skip + best-effort. 향후 다른 type 도 같은 함수로 추가 가능
  - `apps/api/src/comments/comments.module.ts` — NotificationsModule import
  - `apps/api/src/comments/comments.service.ts` — page select 에 authorId, parent select 에 authorId 추가. create 직후 best-effort 트리거: dto.parentId 있으면 `notifyOne(parent.author, 'comment.reply')`, 없으면 `notifyOne(page.author, 'comment.created')`. payload: pageTitle / actorName / preview(80자)
  - `apps/api/src/notifications/notifications.service.spec.ts` — notifyOne 5 케이스 (정상 / reply 타입 / recipient null skip / 자기 자신 skip / throw swallow)
  - `apps/web/components/NotificationBellButton.tsx` — `describeMention` → `describeNotification` type switch (🔔/💬/↩️ 아이콘 + 다른 문구). 리스트 항목에 type 별 아이콘 노출, 정렬 안정
- **검증**: jest **13 suites · 102 tests** 통과(직전 97 + 신규 5). nest build / tsc EXIT 0. 마이그레이션 **없음** (Cycle 59 모델 재활용)
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 사용자 A 가 사용자 B 의 페이지에 댓글 → B 의 종 아이콘 "💬 A님이 ... 댓글을 달았습니다"
  3) 사용자 A 가 사용자 B 의 댓글에 답글 → B 의 종 아이콘 "↩️ A님이 회원님 댓글에 답글을 달았습니다"
  4) **자기 자신** 페이지에 자기 댓글 → 알림 X (skip)
  5) **자기 댓글**에 자기 답글 → 알림 X (skip)
  6) dedupe: 같은 사람이 같은 페이지에 댓글 여러 번 → 알림 1개
  7) 알림 클릭 → 그 페이지 진입 + 자동 읽음 (Cycle 59 흐름 그대로)
- **남은 일**:
  - watch 기반 page.published 알림 (지켜보기 사용자에게)
  - SMTP 이메일 알림 (FR-102)
  - WebSocket / SSE 실시간 push
- **비고**: notifyOne 은 단일 recipient 일반 트리거 — 향후 다른 type (watch.page_changed, share.received 등) 도 같은 함수로 한 줄 추가. dedupe key 기존 그대로 — 사용자가 한 페이지에 댓글 많이 달아도 알림 1번만 (조용함). 매 댓글 별개 알림 원하면 commentId 도 unique key 에 포함하는 schema 변경 필요.

---

## Cycle 61 — 2026-05-27 — ✅ Done (지켜보는 페이지 발행 알림)
- **제목**: 페이지 발행 시 그 페이지 watcher 들에게 `page.updated` 알림. Cycle 53 WatchList + Cycle 59/60 Notification 결합 — 지켜보기 기능 완성
- **카테고리**: 알림 (Cycle 60 후속, Cycle 53 watch 토글 완성)
- **커밋**: `d45e147`(61-1 BE), `5721c57`(61-2 spec), `685a103`(61-3 FE), 본 CYCLES.md(61-4 Docs)
- **변경 파일**:
  - `apps/api/src/notifications/notifications.service.ts` — NotificationType 에 `page.updated`. `notifyOne` 에 `refresh?:boolean` (true 면 upsert update 에서 `readAt=null` + `createdAt=now` + payload 갱신 — 재알림). `notifyWatchers({actorId, pageId, payload})` — WatchList 조회 → 각 watcher 에게 `notifyOne(page.updated, refresh:true)`. best-effort (조회 실패 swallow)
  - `apps/api/src/pages/pages.service.ts` publish — 멘션 트리거 옆에 `notifyWatchers` 호출 (try/catch 안)
  - `apps/api/src/notifications/notifications.service.spec.ts` — refresh 2 + notifyWatchers 4 = 6 케이스. prismaMock 에 watchList.findMany 추가
  - `apps/web/components/NotificationBellButton.tsx` — `page.updated` case (👁️ + 문구)
- **검증**: jest **13 suites · 108 tests** 통과(직전 102 + 신규 6). nest build / tsc EXIT 0. 마이그레이션 **없음** (Notification + WatchList 재활용)
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 사용자 B 가 페이지 X 지켜보기(👁️ Cycle 53 PageHeader 토글) → 사용자 A 가 X 발행 → B 종 아이콘 "👁️ A님이 회원님이 지켜보는 'X'을(를) 업데이트했습니다"
  3) **재발행마다 재알림** (refresh) — 이미 읽은 알림도 미읽+최신으로 갱신, 종 badge 다시 +1
  4) 작성자 본인이 watcher 여도 자기 발행엔 알림 X (notifyOne 자기 자신 skip)
  5) 멘션 + watch 동시 — 멘션받은 사용자가 watcher 이기도 하면 두 알림 별개(type 다름)
  6) 알림 클릭 → 그 페이지 진입 + 자동 읽음
- **남은 일**: SMTP 이메일 알림(FR-102) / WebSocket·SSE 실시간 push (현재 60초 polling)
- **비고**: **refresh=true 가 watch 알림의 핵심** — 변경 추적이라 매 발행마다 다시 알려야 함(mention/comment 는 refresh=false, 한 번만). dedupe key 동일 `(recipient, actor, page, type)` 이라 같은 actor 의 반복 발행은 알림 1행을 refresh (새 행 안 쌓임 — 깔끔). WatchList 조회 실패도 best-effort 라 발행 본체 안 깨짐. **지켜보기 기능 완성**: Cycle 53(토글) → Cycle 61(알림) 으로 watch 의 실효성 확보.

---

## Cycle 61 followup — 2026-05-27 — ✅ Done (지켜보기 버튼 비활성화)
- **제목**: 사용자 결정 — 지켜보기는 나중으로. PageHeader 버튼 비활성 + '아직 개발 중' 툴팁. BE 알림 인프라(Cycle 61)는 코드로 유지
- **커밋**: `96cd8db`(core FE)
- **변경**: `PageHeader.tsx` — 지켜보기 ActionButton disabled + tooltip '지켜보기 — 아직 개발 중인 기능입니다'. W 단축키 주석처리. watchQuery/watchMutation/toggleWatching + BE notifyWatchers 는 유지 (재활성화 시 disabled/onClick/단축키 3곳만 복구)
- **검증**: tsc + next build EXIT 0
- **비고**: watcher 가 안 생기니 notifyWatchers 도 자연히 알림 0 — BE 무해. 향후 재활성화 1분 작업.

---

## Cycle 62 — 2026-05-27 — ✅ Done (편집기 마무리 — slash 이미지/링크 파일탭/날짜 picker)
- **제목**: Cycle 54 편집 툴바 후속 마무리 3종 — slash '/이미지' 통합 다이얼로그 일관화, 링크 다이얼로그 '파일' 탭, 날짜 native date picker + 한국어 locale
- **카테고리**: 편집기 / UX (Cycle 54 후속)
- **커밋**: `eb6a6f8`(62-1 slash 이미지), `a28a43c`(62-2 링크 파일탭), `01f1ab1`(62-3 날짜 picker), 본 CYCLES.md(62-4 Docs)
- **변경 파일**:
  - **62-1**: `apps/web/lib/stores/useEditorUiStore.ts` 신규 — 전역 `imageDialogOpen` 신호. `EditorToolbar` ImageButton 이 store 구독(로컬 state 제거), slash '/이미지' 가 `getState().openImageDialog()` (prompt 제거). slash·버튼 둘 다 같은 통합 다이얼로그(첨부/웹 URL 탭). slash 가 React 다이얼로그 직접 못 띄우는 한계를 store 신호로 우회
  - **62-2**: `apps/web/components/InternalPageLinkDialog.tsx` — '파일' 탭 추가. 현재 페이지 첨부 목록(GET /pages/:id/attachments) → 클릭 시 `onSelect('/api/attachments/:id')`. pageId 는 usePageStore. 54-A 자리 안내 텍스트 제거. formatBytes 로 크기 표시
  - **62-3**: `apps/web/lib/tiptap/date.ts` 재작성 — `promptForDate` → `pickDate(initial, onPick)` 네이티브 `input[type=date]` picker (showPicker + focus/click fallback, hidden input). `formatKoreanDate` ('2026년 5월 27일'). NodeView 클릭/slash '날짜' 둘 다 picker. attrs.date 는 ISO 보존, 표시만 한국어. slash-commands 의 '날짜' 도 pickDate 사용
- **검증**: tsc + next build EXIT 0. 마이그레이션 **없음**
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 편집 모드 → `/이미지` 입력 → toolbar 🖼️ 와 동일한 통합 다이얼로그(이 페이지 첨부 / 웹에서의 그림)
  3) 편집 모드 → 🔗 링크 (또는 Ctrl+K) → '파일' 탭 → 첨부 클릭 → 링크 적용
  4) `/날짜` 또는 기존 날짜 토큰 클릭 → 달력 picker 팝업 → 선택 시 "2026년 5월 27일" 표시
  5) 날짜 발행 후 새로고침 → 그대로 유지 (Cycle 57 JSON 라운드트립)
  6) slash `/` 다른 항목들 회귀 없음
- **남은 일**: 이미지 크기 조절 핸들 — 별도 Cycle (TipTap 2.x 기본 미지원, 외부 패키지 peer 충돌/자체 NodeView 대형)
- **비고**: slash command(.ts, React 밖)가 다이얼로그를 직접 마운트 못 하는 한계 → zustand store 신호(getState)로 우회. 날짜 picker 는 브라우저 native UI(input[type=date].showPicker) 라 라이브러리 0 + peer 충돌 회피. 한국어 표시는 NodeView/renderHTML 둘 다 적용, attrs.date 는 ISO 보존(정렬·파싱 안전). 라운드트립은 Cycle 57 JSON 저장이 보장하므로 markdown serialize 는 표시용 텍스트만.

---

## Cycle 63 — 2026-05-27 — ✅ Done (이미지 리사이즈 + 컨트롤 toolbar)
- **제목**: 이미지 크기 조절(드래그+px) / 원본 / 테두리 / 정렬(옆 텍스트 float) / 연결 — ImageNodeView 확장
- **카테고리**: 편집기 / 이미지 (Cycle 54-C 후속, "별도 사이클" 로 미뤘던 대형)
- **커밋**: `e79b912`(63-1 attr+리사이즈), `88779dc`(63-2 toolbar), `82b4e47`(63-3 연결), 본 CYCLES.md(63-4 Docs)
- **변경 파일**:
  - `apps/web/components/CollaborativeEditor.tsx` Image `.extend` addAttributes — `width`/`border`/`align`/`link` 추가. renderHTML `() => ({})` (img/figure 에 잘못된 속성 출력 방지). JSON 저장(Cycle 57)이 attr 라운드트립 담당
  - `apps/web/components/ImageNodeView.tsx` 대폭 확장:
    - 우하단 **리사이즈 핸들**(편집 모드, `nwse-resize` 커서). 드래그 중 로컬 `previewWidth` 미리보기 → mouseup 에 `updateAttributes({width})` 한 번 (Yjs transaction 폭주 방지)
    - **floating toolbar**(selected 시): width px input / 원본(width null) / 테두리 토글 / 정렬 ⬅☰➡ / 🔗연결. 선택 시 img outline(파란)
    - **align float**(좌/우) → 텍스트가 이미지 옆으로 흐름 (가운데는 mx-auto). inline node 전환 대신 float 라 schema 변경 없음
    - **연결**: 조회 모드 + link 면 img 를 a(target=_blank, noopener) 로 감싸 클릭 이동. 편집 모드는 selection/resize 위해 a 없이 img 직접
    - caption(54-C) 유지
- **검증**: tsc + next build EXIT 0. 마이그레이션 **없음** (JSON 저장)
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 편집 모드 이미지 → 우하단 핸들 드래그 → 크기 조절 (커서 nwse-resize)
  3) 이미지 클릭(선택) → 위에 toolbar: px 입력 / 원본 / 테두리 / 정렬 / 연결
  4) 정렬 ⬅ 또는 ➡ → 텍스트가 이미지 옆으로 흐름(float)
  5) 테두리 토글 → 이미지 테두리 on/off
  6) 🔗 연결 → URL 입력 → 조회 모드에서 이미지 클릭 시 새 창 이동
  7) 발행 후 새로고침 → 크기/테두리/정렬/연결 유지 (JSON 라운드트립)
- **남은 일**: 8방향 핸들·% 단위·이미지 정렬 시 캡션 폭 동기화 등 고도화는 필요 시점
- **비고**: TipTap 2.x 기본 미지원이라 **자체 NodeView 로 구현** (외부 패키지 peer 충돌 회피 — Cycle 55 멘션 교훈). 드래그는 로컬 previewWidth 후 mouseup 1회 commit(Yjs transaction 폭주 방지). attr 4종(width/border/align/link) 모두 JSON 저장으로 라운드트립, markdown export 만 미반영(수용). **Cycle 54 편집 툴바 정비 영역 사실상 완성** (54-D/A/B/F/C + 62 + 63). **followup 3차**: 캡션 prompt→textarea + 정렬 좌/가운데/우(float 제거, 블록, 에디터 상단 툴바로 통합) + 검정 테두리 + 커서 1개.

---

## Cycle 64 — 2026-05-27 — ✅ Done (본문 다이어그램 노드 — ＋/slash 에서 Excalidraw 생성)
- **제목**: 편집기 ＋/slash 에서 Excalidraw 다이어그램 생성 + 본문 노드로 삽입
- **카테고리**: 편집기 / 다이어그램
- **커밋**: `fac1696`(64-1 노드+NodeView), `f9561be`(64-2 slash), 본 CYCLES.md(64-3 Docs)
- **변경 파일**:
  - `apps/web/lib/tiptap/diagram.ts` 신규 — DiagramNode(block atom, attrs.diagramId). 본문엔 id 만(content 가벼움). markdown serialize 는 '[다이어그램]' placeholder
  - `apps/web/components/DiagramNodeView.tsx` 신규 — diagramId → GET /api/diagrams/:id preview 표시. 편집 모드 클릭 → DiagramEditorModal(ExcalidrawEditor) → PATCH 저장 → preview 갱신
  - `apps/web/components/CollaborativeEditor.tsx` — extensions 에 DiagramNode 등록
  - `apps/web/lib/tiptap/slash-commands.ts` — '다이어그램' 항목 (usePageStore.pageId → POST /diagrams → diagramId 노드 삽입). ＋ popup 도 같은 카탈로그
- **검증**: tsc + next build EXIT 0. 마이그레이션 **없음** (기존 Diagram 엔티티 재활용)
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 편집 모드 → `/다이어그램` 또는 ＋ → '다이어그램' → 본문에 다이어그램 노드 삽입
  3) 노드 클릭 → Excalidraw 모달 → 그리기 → 저장 → preview 갱신
  4) 조회 모드 → preview 표시 (편집 불가)
  5) 발행 후 새로고침 → 노드(diagramId) 유지 (JSON 라운드트립)
- **남은 일**: 본문 다이어그램 노드 삭제 시 Diagram 엔티티 orphan 정리(현재 엔티티 잔존) — 필요 시점
- **비고**: **draw.io 미채택** — Confluence draw.io 앱은 유료 + `embed.diagrams.net` 외부 임베드는 사내망/Skyhigh 프록시 차단 리스크(운영 환경 편집 불가 위험). 기존 무료 내장 Excalidraw 유지(사용자 결정). 본문엔 diagramId 만 저장, data/preview 는 기존 diagrams API(POST/GET/PATCH/DELETE) 재활용. **DiagramList 별도 섹션은 조회에서 제거됨(직전 followup) → 본문 노드가 이제 다이어그램의 주 진입점**. DiagramList/DiagramCard 파일은 보존(향후 재활용 가능).

---

## Cycle 65 — 2026-05-28 — ✅ Done (public/icons 아이콘을 UI 전반에 적용)
- **제목**: `apps/web/public/icons/*` 아이콘 자산을 액션바/에디터 툴바/사이드바 이모지 대체에 적용
- **카테고리**: FE / 디자인 (아이콘 일관화)
- **커밋**: `2f122c0`(65-1 코드+자산), 본 CYCLES.md(65-2 Docs)
- **변경 파일**:
  - `apps/web/components/AppIcon.tsx` 신규 — 의미 이름(`edit`/`comment`/`share`/`home`/`page`/`calendar`/`bulletList`/`numberList`/`link`/`plus`/`trash`/`watch`/`star` …) → `/icons/*` 매핑 공용 컴포넌트. **next/image 는 SVG 기본 차단**(images.dangerouslyAllowSVG=false) 이라 PNG·SVG 를 한 컴포넌트에서 다루기 위해 정적 `<img>` 직접 사용(아이콘은 작은 로컬 자산). `size` prop(기본 16)
  - `apps/web/components/PageHeader.tsx` — 조회/편집 액션바: 편집(pencil_edit)·인라인댓글(comment)·지켜보기(watch)·공유(share) + MoreMenu(내보내기=page / 공간 홈=home / 페이지 삭제=trash) 이모지 → AppIcon. `ActionButton.icon` prop `string` → `ReactNode`
  - `apps/web/components/EditorToolbar.tsx` — 글머리(bullet_list)·번호(number_list)·링크(link)·인라인댓글(comment)·＋삽입(plus)·표삭제(trash) 이모지 → AppIcon
  - `apps/web/components/Sidebar.tsx` — 홈(home)·페이지(page)·캘린더(calendar)·즐겨찾기(star)·휴지통(trash) 이모지 → AppIcon. `NavItem.icon` prop `string` → `ReactNode`
  - `apps/web/public/icons/` — 신규 아이콘 자산 커밋(bullet_list/comment/link/number_list/plus + dot/down-arrow/information/user 예비)
- **검증**: `tsc --noEmit` EXIT 0. 마이그레이션 **없음**
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 페이지 조회 상단 액션바 — 편집/댓글/지켜보기/공유 버튼이 이미지 아이콘으로 표시
  3) 편집 모드 툴바 — 글머리/번호/링크/인라인댓글/＋/표삭제 아이콘
  4) 사이드바 — 홈/페이지/캘린더/즐겨찾기/휴지통 아이콘
  5) ⋯ 더보기 — 내보내기/공간 홈/삭제 항목 앞 아이콘
- **남은 일**: 미적용 이모지(저장 🔖/💾, 발행 🚀, 알림 종 🔔, 다이어그램 📐, 활동피드 등) — 대응 아이콘 자산 없음/맥락상 이모지 유지. 필요 시 자산 추가 후 확장. **브라우저 시각 확인 미수행**(API/DB 기동 필요) — 타입체크만 통과
- **비고**: `next/image` 가 SVG 를 기본 차단하므로 정적 `<img>` + `eslint-disable @next/next/no-img-element`(DiagramNodeView 등 기존 관례와 동일) 사용. SVG 아이콘(home/page/calendar)은 `fill` 미지정이라 기본 검정 렌더 — 라이트 배경에서 정상. PNG 아이콘은 SpaceStarButton(star.png 14px) 선례대로 소형 렌더 검증됨.

---

## Cycle 66 — 2026-05-29 — ✅ Done (편집 진입마다 본문 누적되는 버그 수정)
- **제목**: 조회 시 빈 본문인 페이지를 편집 모드로 들어갈 때마다 동일 목록/노드가 한 벌씩 늘어나던 버그 fix
- **카테고리**: FE / 버그 (협업 에디터 초기 seed)
- **커밋**: `a526e93`(66-1 코드), 본 CYCLES.md(66-2 Docs)
- **변경 파일**:
  - `apps/web/components/CollaborativeEditor.tsx` — ① `instance` state 에 `persistence`(IndexeddbPersistence) 포함 ② seed 효과를 `provider.synced`(서버) 단독 대기 → `persistence.whenSynced`(IndexedDB) + `provider.synced` **둘 다** 대기 후 `frag.length===0` 판정으로 변경. `cancelled` 가드 + IndexedDB 불가 시 fallback seed(`.then(trySeed, trySeed)`)
- **검증**: `tsc --noEmit` EXIT 0. 마이그레이션 **없음**
- **증상/원인**: 조회=빈 본문인데 편집 진입 시 단추형 목록 1개 → 저장 없이 재진입마다 +1 누적. 원인은 **초기 seed 타이밍 경쟁** — 편집 진입 시 컴포넌트가 `key` 로 재마운트되며 새 Y.Doc + IndexedDB 영속 + Hocuspocus provider 생성. 서버는 Y.Doc 을 **영속하지 않아**(Redis 는 멀티 인스턴스 pub/sub 용) localhost in-process WS sync 가 IndexedDB 로드보다 먼저 끝남 → 그 찰나 frag 가 비어 보여 draft(=`draftContent`, React Query 캐시라 세션 간 1개 고정) 를 재삽입 → 직후 IndexedDB 가 이전 세션 본문 로드 → Yjs merge(concat) → 1벌 누적
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 빈 본문 페이지 편집 진입 → 빠져나오기(저장 X) → 재진입 반복 시 본문이 늘지 않는지 확인
  3) 기존 페이지 편집 시 본문이 정상 1벌로 로드되는지(중복 시드 회귀 없음) 확인
- **남은 일**: **기존 누적분은 자동 정리 안 됨** — 이미 브라우저 IndexedDB 에 쌓인 사본은 편집 모드에서 수동 삭제 후 재발행하거나 사이트 데이터 삭제로 정리. **브라우저 시각 확인 미수행**(API/DB 기동 필요) — 타입체크만 통과
- **비고**: 서버 미영속 구조(=IndexedDB 가 유일 durable store) 가 이 race 의 전제. 멀티 인스턴스(USE_REDIS=true)로 가도 Redis 는 pub/sub 일 뿐 durable 이 아니므로 동일. 서버측 Y.Doc 영속(onStoreDocument/Database extension) 도입 시 seed 설계 재검토 필요.

---

## Cycle 67 — 2026-05-29 — ✅ Done ('더 많은 내용 삽입' 드롭다운 화살표 + 툴바 중복 제거)
- **제목**: 편집 툴바 ＋(더 많은 내용 삽입) 버튼에 드롭다운 화살표 추가 + 드롭다운에서 툴바와 중복되는 항목 제거
- **카테고리**: FE / UI (에디터 툴바 정리)
- **커밋**: `02b8cc2`(67-1 코드), 본 CYCLES.md(67-2 Docs)
- **변경 파일**:
  - `apps/web/components/EditorToolbar.tsx` — ① `InsertMoreButton` 의 ＋ 아이콘 옆에 `down-arrow`(10px) 표기(드롭다운 affordance). ② 드롭다운 항목 소스를 `filterItems` → `insertMoreItems` 로 교체. import 정리(주석에서만 쓰이던 `SLASH_ITEMS`, 유일 사용처였던 `filterItems` 제거)
  - `apps/web/lib/tiptap/slash-commands.ts` — `TOOLBAR_ITEM_TITLES` 집합 + `insertMoreItems(query)` 헬퍼 추가. 슬래시(/) 메뉴가 쓰는 `filterItems` 는 무변경(전체 노출 유지)
- **검증**: `tsc --noEmit` EXIT 0. 마이그레이션 **없음**
- **제외/유지 기준**: 툴바에 전용 버튼/드롭다운이 있는 항목은 InsertMore 에서 제외 — 제목1~4(문단 스타일 드롭다운)·인용문·불릿/번호/체크리스트(목록 그룹)·표·이미지·구분선·링크(삽입 그룹). **남는 항목: 코드 블록·수식·날짜·다이어그램**(툴바 미제공). 코드 블록은 문단 스타일 드롭다운이 *감지*만 하고 설정 항목엔 없어(Cycle 37 followup 의도적 제외) 중복 아님 → 유지
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 편집 툴바 ＋ 버튼 — 옆에 아래 화살표 표시 + 클릭 시 4개 항목(코드 블록/수식/날짜/다이어그램)만 노출
  3) 본문에서 `/` 입력 — 슬래시 메뉴는 여전히 전체 카탈로그 노출(회귀 없음)
- **남은 일**: **브라우저 시각 확인 미수행**(API/DB 기동 필요) — 타입체크만 통과. 화살표 크기(10px)/간격은 실제 렌더 후 미세조정 여지
- **비고**: `insertMoreItems` 는 정확 title 비교(`TOOLBAR_ITEM_TITLES`) — 카탈로그 title 변경 시 동기화 필요(헬퍼 주석에 경고 명시). down-arrow 자산은 Cycle 65 에서 예비로 커밋해둔 `public/icons/down-arrow.png` 재활용.

---

## Cycle 68 — 2026-05-29 — ✅ Done (인라인 댓글 기능 전체 제거)
- **제목**: 조회 화면 '인라인 댓글 보기' 토글 + 작성 경로(마크/버튼/다이얼로그)까지 인라인 댓글 기능 전체를 FE 에서 제거
- **카테고리**: FE / 기능 제거 (FR-071 롤백)
- **커밋**: `464ccd1`(68-1 코드), 본 CYCLES.md(68-2 Docs)
- **배경**: 조회 화면의 '인라인 댓글 보기' 액션버튼이 기본 active(`useState(true)`)인데, `InlineCommentsList` 는 인라인 댓글 0건이면 `null` 반환 → "토글은 켜져 있는데 화면엔 아무것도 없음" → 불필요/고장처럼 보임. 사용자 확인 후 작성 경로 포함 **전체 제거(옵션 B)** 결정
- **변경 파일**:
  - **삭제** `apps/web/components/InlineCommentsList.tsx` / `InlineCommentDialog.tsx` / `apps/web/lib/tiptap/inline-comment-mark.ts`
  - `apps/web/app/(app)/page.tsx` — `showInlineComments` 상태·PageHeader 토글 props·`InlineCommentsList` 조건부 렌더 제거
  - `apps/web/components/PageHeader.tsx` — '인라인 댓글 보기' 액션버튼 + **V 단축키** + 관련 props/destructure/deps 제거
  - `apps/web/components/EditorToolbar.tsx` — 툴바 `InlineCommentButton`(+ `InlineCommentDialog` import) 제거
  - `apps/web/components/CollaborativeEditor.tsx` — `InlineCommentMark` schema 등록 제거 + `parseContent` 에 `stripInlineCommentMarks` 추가
  - `apps/web/app/globals.css` — `.cf-inline-comment` 하이라이트 스타일 2블록 제거
- **검증**: `tsc --noEmit` EXIT 0. 마이그레이션 **없음**
- **데이터 안전**: 마크를 schema 에서 빼면 기존 페이지 JSON(Cycle 57)에 남은 `inlineComment` 마크가 로드 시 schema 불일치로 본문을 깨뜨림 → `parseContent` 가 로드 직전 트리에서 해당 마크만 필터(텍스트 보존). **발행본(DB JSON) 경로는 안전**
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 조회 화면 액션바에서 '인라인 댓글 보기' 버튼 사라짐, V 단축키 무동작
  3) 편집 툴바에서 인라인 댓글(말풍선) 버튼 사라짐
  4) 일반 페이지 댓글(`PageComments`)·반응 바는 그대로 동작
- **남은 일**: **백엔드 댓글 API 의 `isInline`/anchor/`resolve` 경로는 잔존**(호출 FE 없음, 무해) — 완전 정리는 별도 사이클. **엣지 케이스**: 과거 인라인 댓글 단 페이지를 *편집 모드*로 열 때 그 브라우저 IndexedDB(Yjs)에 마크가 남아 있으면 깨질 수 있음(발행본은 안전) → 사이트 데이터 삭제로 해소. **브라우저 시각 확인 미수행**
- **비고**: FR-071(Cycle 16-3b-1/2)의 FE 부분 롤백. 백엔드/DB(Comment.isInline, anchorJson) 스키마는 보존 — 향후 재도입 시 작성/표시 UI 만 다시 붙이면 됨.

---

## Cycle 69 — 2026-05-29 — ✅ Done ('나중을 위해 저장' 별표 아이콘 + 홈 저장목록 서버 연동)
- **제목**: 조회 화면 저장 버튼을 별표 아이콘으로 바꾸고, 저장한 페이지가 홈 '나중을 위해 저장' 뷰에 실제로 표시되도록 서버 SavedPage 단일 출처로 연결
- **카테고리**: FE + BE / 기능 (저장 페이지 surface)
- **커밋**: `5c06f80`(69-1 코드), 본 CYCLES.md(69-2 Docs)
- **배경**: ① 저장 버튼이 이모지(🔖/💾)라 별표 요청. ② 홈 SavedView 는 `useFavoritesStore`(localStorage)를 읽는데 그 store 의 `toggle` 을 호출하는 UI 가 어디에도 없어 **항상 비어 있던 고아 기능**이었음. 반면 PageHeader 저장 버튼은 백엔드 `SavedPage` 에 잘 저장되지만 어떤 목록에도 안 떴음 → 서버를 단일 출처로 통합(사용자 선택)
- **변경 파일**:
  - `apps/web/components/PageHeader.tsx` — 저장 버튼 아이콘 이모지 → `AppIcon` `star`/`starOutline`(저장됨=채운 별). 라벨 상태 무관 '나중을 위해 저장' 고정(기존 '저장됨' 토글 제거). `active` 파란 배경(`bg-[#deebff]`) 제거 — 아이콘 변화만으로 상태 표시. 저장 토글 성공 시 `["my-saves"]` invalidate
  - `apps/web/app/(app)/home/page.tsx` — `SavedView` 가 favorites store 대신 `GET /api/saves` 조회로 재작성. 빈 상태 문구 갱신. 미사용된 `useFavoritesStore` import 제거
  - `apps/api/src/saves/saved-list.controller.ts` **신규** — `GET /api/saves`(JWT). `pages/:id/save`(SavesController)와 prefix 달라 별도 컨트롤러
  - `apps/api/src/saves/saves.service.ts` — `listSaved(userId)`: 내 SavedPage 최근 저장순, **삭제·미발행 페이지 제외**, `{id,title,spaceId,spaceName}` 반환
  - `apps/api/src/saves/saves.module.ts` — `SavedListController` 등록
- **검증**: web/api `tsc --noEmit` 둘 다 EXIT 0. 마이그레이션 **없음**(스키마 무변경)
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 페이지 조회 상단 '나중을 위해 저장' — 빈 별/채운 별 토글, 클릭해도 파란 배경 없음, 라벨 항상 동일
  3) 저장 후 홈 `/home?view=saved` → 해당 페이지가 목록에 표시(다른 기기/브라우저에서도 유지)
  4) 저장 해제 시 목록에서 사라짐
- **남은 일**: **Sidebar '즐겨찾기' 섹션**은 여전히 토글 UI 없는 `useFavoritesStore` 를 읽어 비어 있음 — 이번 범위 밖. 필요 시 별도 사이클에서 백엔드 saves 로 통합. `listSaved` 단위 테스트 미추가. **브라우저 시각 확인 미수행**
- **비고**: 서버(JWT별 SavedPage)를 단일 출처로 채택 — favorites store 의 "user id 기반 모델 마이그레이션 예정"(FR-025 주석) 방향과 일치. `useFavoritesStore` 파일 자체는 Sidebar 가 아직 참조해 보존.

---

## Cycle 70 — 2026-05-29 — ✅ Done (페이지 작업 상태 To Do / In Progress / Done)
- **제목**: Polarion/Notion 식 페이지 작업 상태 배지 도입 — 표시 + 변경(필터/알림/권한 시스템은 별 사이클)
- **카테고리**: BE + FE / 기능 (페이지 워크플로 상태)
- **커밋**: `8ba5cbe`(70-1 코드), 본 CYCLES.md(70-2 Docs)
- **데이터 모델**: `enum PageStatus { TODO IN_PROGRESS DONE }` + Page 에 `status`(nullable)/`statusAt`/`statusById`/`statusBy`(+ User `@relation("PageStatusBy")` back-relation). null = 상태 없음(배지 미표시)
- **변경 파일 (BE)**:
  - `apps/api/prisma/schema.prisma` + 마이그레이션 `20260529000000_page_status` — enum/컬럼/인덱스/FK
  - `apps/api/src/pages/dto/update-page-status.dto.ts` 신규 — `{ status: PageStatus | null }`(null 허용)
  - `apps/api/src/pages/pages.service.ts` — `changeStatus(id, status, user)`: **임시 가드(작성자 또는 ADMIN)**, status/statusAt/statusById 갱신, `page.status_changed` 활동 기록(payload `{from,to}`). `recent()` select 에 status
  - `apps/api/src/pages/pages.controller.ts` — `@Patch(':id/status') @UseGuards(JwtAuthGuard)` + `userFromReq`(role 포함)
  - `apps/api/src/activities/activities.service.ts` — `ActivityType` union 에 `'page.status_changed'`
  - `apps/api/src/saves/saves.service.ts` — `listSaved` select 에 status
  - `apps/api/src/pages/pages.service.spec.ts` — changeStatus 가드(403)/활동기록/no-op 테스트
- **변경 파일 (FE)**:
  - `apps/web/components/PageStatusBadge.tsx` 신규 — 색상 배지(To Do 회색/In Progress 파랑/Done 초록, null 미표시)
  - `apps/web/components/PageStatusDropdown.tsx` 신규 — 배지 클릭 메뉴(현재 ✓, 외부클릭·Esc 닫힘), optimistic 반영 + 목록/피드 쿼리 무효화, 권한 없으면 클릭 불가+툴팁
  - `PageHeader.tsx`(조회 H1 옆) / `FullScreenEditor.tsx`(편집 제목 옆) 배지 연결, `canEditStatus = ADMIN || author`
  - `PageCard.tsx` status 배지 / `home/page.tsx` RecentView·SavedView status 전달 + `HOME_ACTIVITY_TYPES` 에 `page.status_changed` / `activity-format.ts` 라벨·케이스 / `lib/types.ts` `PageStatus` + status 필드
- **검증**: web/api `tsc --noEmit` EXIT 0. API jest **115 passed (13 suites)** — 새 changeStatus 7건 포함
- **동작 확인 안내**:
  1) ⚠️ **`cd apps/api && npx prisma migrate deploy`** (+ 필요 시 `npx prisma generate`) — 마이그레이션 적용 필수
  2) 페이지 제목 옆 배지 — 상태별 색상(회색/파랑/초록)
  3) 상태 없음(null) 페이지는 배지 미표시(작성자/ADMIN 헤더엔 '+ 상태' 추가 affordance)
  4) 조회 + 편집 화면 모두 배지 표시
  5) PageCard(최근 작업/저장 목록)에서도 배지
  6) 배지 클릭 → 드롭다운, 현재 상태 ✓
  7) 다른 상태 선택 → 즉시 반영(새로고침 없이, optimistic)
  8) '상태 제거' → 배지 사라짐
  9) 작성자/ADMIN 외 사용자 → 배지 클릭 불가 + "상태 변경 권한이 없습니다" 툴팁
  10) `PATCH /pages/:id/status` 직접 호출 시 비작성자·비ADMIN → 403
  11) 상태 변경 후 `/home` 활동 피드에 `page.status_changed` 항목 노출
  12) 활동 사용자 필터(`HOME_ACTIVITY_TYPES`)에 정상 포함
- **남은 일**: **권한은 임시 가드(작성자/ADMIN)** — 향후 권한 시스템 사이클에서 페이지 단위 권한/자물쇠로 교체. **필터링(상태별 보기)·상태 변경 알림은 별 사이클**. Sidebar 페이지 트리 배지는 범위 외(제외). **브라우저 시각 확인 미수행**(API/DB 기동 필요) — 타입체크·단위테스트만 통과
- **비고**: 마이그레이션은 `migrate dev` 가 기존 체크섬 드리프트(EOL)로 DB 리셋을 요구해 거부됨 → **수기 마이그레이션 파일 + `migrate deploy`** 로 비파괴 적용(미적용이던 `notifications` 마이그레이션도 함께 적용됨). `ActivityLog.type` 은 enum 이 아니라 `String` 이라 새 type 은 union 추가만으로 충분. 배지 색상 결정: To Do `#dfe1e6/#42526e`, In Progress `#deebff/#0052cc`, Done `#e3fcef/#006644`.

---

## Cycle 71 — 2026-05-29 — ✅ Done (칸반 보드 뷰 + 페이지 목록 상태 필터)
- **제목**: Cycle 70 Page.status 를 활용한 ① 페이지 목록 상태 필터 ② 스페이스 칸반 보드(드래그앤드롭)
- **카테고리**: BE + FE / 기능 (상태 뷰)
- **커밋**: `de9d9e8`(71-1 코드), 본 CYCLES.md(71-2 Docs)
- **마이그레이션 없음** — 신규 모델 X, Page.status 재활용 + BE 쿼리 메서드만 추가
- **결정**: 라우트는 `?spaceId=X&view=board`(코드베이스에 동적 라우트 없음, 기존 view 쿼리 컨벤션 일치). 필터는 다중 선택(서버사이드 `?status=`, 오프셋 페이징과 일관). 'NONE'=상태 없음(null)
- **변경 파일 (BE)**:
  - `apps/api/src/pages/pages.service.ts` — `statusWhere()`(NONE=null + enum in, 혼합 OR) + `recent()` 에 `statuses?` 필터 + `boardPages(spaceId)`(발행·비삭제 전체 cap 500)
  - `apps/api/src/pages/pages.controller.ts` — `@Get('recent')` `?status=` 콤마 파싱(`parseStatuses`, `:id` 위) + 신규 `@Get('board')`
  - `apps/api/src/pages/pages.service.spec.ts` — status where 3종 + board 2종 + 미지정 1종
- **변경 파일 (FE)**:
  - `StatusFilterChips.tsx` 신규 — 다중 선택 칩(전체/상태없음/To Do/In Progress/Done)
  - `SpacePagesView.tsx` — 필터 칩 + `?status=` URL 동기화(서버 필터) + PageCard status 배지
  - `KanbanBoard/KanbanColumn/KanbanCard.tsx` 신규 — 4컬럼 + 헤더 색상·카운트 + `@dnd-kit/core` DnD(드롭 → `PATCH /pages/:id/status` optimistic + recent/activities 무효화), 권한 없으면 드래그 비활성+툴팁, 빈 컬럼 안내, 카드 클릭 시 페이지 이동
  - `page.tsx` — `isBoardView`(`view==='board'`) 분기 + 페이지 fetch 가드에 포함(view=pages 와 동일)
  - `Sidebar.tsx` — '보드' NavItem(`chart` 아이콘, `?spaceId=X&view=board`)
- **검증**: web/api `tsc --noEmit` EXIT 0. API jest **121 passed (13 suites)** — 신규 6건 포함
- **동작 확인 안내**:
  1) **마이그레이션 불필요**(신규 마이그레이션 없음)
  2) 페이지 목록 상단 필터 칩 선택 → 결과 즉시 반영, `?status=` URL 동기화
  3) 새로고침/뒤로가기 시 필터 유지(URL 단일 출처)
  4) 다중 선택(예: To Do + Done) 정상
  5) 스페이스 사이드바 '보드' 항목 → `view=board`
  6) 보드 4컬럼(상태없음/To Do/In Progress/Done) + 카드 렌더
  7) 컬럼 헤더 카운트(draft 제외)
  8) 카드 드래그 → 다른 컬럼 드롭 → 상태 변경 + 카운트 갱신(optimistic)
  9) 권한 없는 사용자 → 드래그 비활성 + "상태 변경 권한이 없습니다" 툴팁
  10) 빈 컬럼 "이 상태의 페이지가 없습니다"
  11) draft(미발행)는 필터·보드 어디에도 안 보임
- **남은 일**: 사이드바 상태별 카운트 / 개인 대시보드 / 상태 변경 알림은 별 사이클. 보드 카드 클릭 vs 드래그는 PointerSensor 8px 임계로 구분(드래그 후 stray click 가능성은 미세 — 실사용 확인 권장). **브라우저 시각 확인 미수행**(API/DB 기동 필요) — 타입체크·단위테스트만 통과
- **비고**: dnd-kit 은 `@dnd-kit/core`(DndContext/useDraggable/useDroppable) 사용 — 사이드바의 sortable 과 별개 패턴. `@dnd-kit/utilities` 의존 회피 위해 transform 을 `translate3d` 문자열로 직접 생성. 보드는 한 번에 fetch 후 클라 그룹핑(cap 500). 권한 가드는 Cycle 70 그대로(작성자/ADMIN), 백엔드 PATCH 가 최종 검증.

---

## Cycle 72 — 2026-05-29 — ✅ Done (프레즌스·authorName 실명 표시)
- **제목**: 협업 커서·authorName 에 랜덤 익명 이름('부지런한 다람쥐') 대신 로그인 사용자 실명 사용
- **카테고리**: FE / 버그 (인증 잔재 정리)
- **커밋**: `c9f8d1d`(72-1 코드), 본 CYCLES.md(72-2 Docs)
- **원인**: `lib/userIdentity.ts` 의 `getIdentity()` 가 localStorage 에 랜덤 익명 이름(형용사+동물+suffix)을 만들어 사용 — Keycloak 인증(Cycle 43) 이전 잔재. 노출 지점: 협업 프레즌스 커서 라벨(타 사용자에게 보임), 첨부/이미지 업로드·버전 복원·발행 시 클라이언트 전송 `authorName`
- **변경 파일**:
  - `apps/web/lib/useIdentity.ts` **신규** — `useAuth()` 기반 훅. 로그인 사용자의 실제 `name`/`id` + id 해시 결정적 색상(같은 사용자=항상 같은 프레즌스 색). 비로그인/로딩/SSR 만 `getIdentity()` 익명 폴백
  - `CollaborativeEditor.tsx` — `useMemo(getIdentity)` → `useIdentity()`(프레즌스 awareness + autosave authorName)
  - `AttachmentList.tsx` / `ImageInsertDialog.tsx` / `PageVersionHistory.tsx` / `app/(app)/page.tsx` — `getIdentity().name` → `identity.name`(useIdentity)
- **검증**: web `tsc --noEmit` EXIT 0. 마이그레이션 **없음**(FE 전용)
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 두 사용자가 같은 페이지 동시 편집 → 커서 라벨에 상대 **실명** 표시(익명 아님)
  3) 첨부 업로드 / 이미지 삽입 / 버전 복원 / 발행 후 작성자명이 실명
- **남은 일**: **과거 익명으로 저장된 데이터**(author FK 없이 authorName 만 익명인 옛 첨부/버전)는 소급 변경 안 됨 — 앞으로 생성분만 실명. 서버가 클라 `authorName` 대신 JWT actor 를 강제로 쓰도록 굳히는 건 별도(현재는 클라가 실명을 보냄). **브라우저 시각 확인 미수행**
- **비고**: `getIdentity()`/`userIdentity.ts` 는 폴백용으로 보존(useIdentity 내부에서만 참조). 댓글/반응은 원래 서버 JWT actor 기반이라 무관.

---

## Cycle 73 — 2026-05-29 — ✅ Done (칸반 보드 사용자 필터)
- **제목**: 스페이스 칸반 보드에 작성자/편집자 기준 사용자 필터 추가
- **카테고리**: BE + FE / 기능 (보드 필터)
- **커밋**: `32a6922`(73-1 코드), 본 CYCLES.md(73-2 Docs)
- **⚠️ 중복 회피 메모**: 요청서엔 "칸반 보드 + 사용자 필터"로 적혀 있었으나 **보드 본체(라우트 `?view=board`·진입점·DnD·권한 가드·`GET /pages/board`)는 직전 Cycle 71 에서 이미 구현·push 완료**. 사전 조사로 확인 후 사용자에게 보고 → 이번 사이클은 **사용자 필터만** 추가하기로 합의. (페이지 목록 상태 필터(Cycle 71)는 "그대로 둔다", 사용자 검색은 "이름/사용자명만" 결정.)
- **변경 파일 (BE)**:
  - `apps/api/src/pages/pages.service.ts` — `boardPages(spaceId, userIds?)`: userIds 있으면 where 에 `OR:[{authorId:{in}},{lastEditorId:{in}}]`(다중 OR)
  - `apps/api/src/pages/pages.controller.ts` — `@Get('board')` 에 `?userId=` 콤마 파싱
  - 사용자 검색은 **기존 `GET /api/users?q=` 재활용**(신규 API 없음)
  - `pages.service.spec.ts` — userIds where + 빈 배열 회귀
- **변경 파일 (FE)**:
  - `UserSearchCombobox.tsx` 신규 — `GET /api/users?q=` 검색 팝업(외부클릭/Esc, 이미 선택된 사용자 제외)
  - `UserFilterChips.tsx` 신규 — 선택 칩+X, '나' 빠른 추가, '+ 사용자 추가', 초기화
  - `KanbanBoard.tsx` — `?userId=` URL 동기화, 보드 fetch 에 userId 반영(서버사이드 필터), 칩 이름 해석(`users-all` 쿼리 + 현재 사용자), 카운트는 필터된 집합 기준 자동 반영
- **검증**: web/api `tsc --noEmit` EXIT 0. API jest **123 passed (13 suites)** — 신규 2건 포함. 마이그레이션 **없음**
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 보드 상단 '+ 사용자 추가' → 검색 → 선택 → 칩 표시
  3) '+ 나' 로 현재 사용자 즉시 필터
  4) 다중 선택 OR(선택자 중 누구라도 작성자/편집자인 페이지)
  5) 칩 X / 초기화 → 즉시 갱신, 컬럼 카운트도 갱신
  6) `?userId=` URL 동기화(새로고침/공유 유지)
  7) 상태(컬럼)와 사용자 필터 AND
  8) draft 제외·권한 가드·DnD 등 보드 기존 동작 회귀 없음
- **남은 일**: 사이드바 카운트 / 개인 대시보드 / 알림 / 멤버 아바타 필터(스페이스 멤버 모델 필요)는 별 사이클. 이메일 검색은 미도입(이름/사용자명만). 칩 이름 해석용 `users-all` 은 전체 사용자 fetch(소규모 조직 전제) — 대규모 시 id 기반 batch 조회로 대체 여지. **브라우저 시각 확인 미수행**
- **비고**: 보드는 한 번에 fetch 후 클라 그룹핑이라 사용자 필터를 서버(`?userId=`)에서 적용 → 카운트가 자동으로 필터 반영. 사용자 검색 API 가 email 을 검색/반환하지 않아 칩/검색은 이름·부서 기준.

---

## Cycle 74-A — 2026-05-29 — ✅ Done (스페이스 권한 시스템 기반)
- **제목**: 스페이스 단위 권한(SpaceMember/visibility) 모델 + 권한 판정 서비스 + 생성자 자동 Admin + 읽기 경로 가드. "공간 도구" 메가 사이클(74)의 **필수 선행 sub-cycle A**.
- **카테고리**: BE / 권한 (대규모, 회귀 위험 최고)
- **커밋**: `<74-A 코드>`, 본 CYCLES.md
- **결정(사전 조사 합의)**: 백필=기존 SITE→PUBLIC·멤버 0명 + 전역 ADMIN override / PERSONAL→PERSONAL. 라우트=`?view=settings`(B에서). 감사로그=ActivityLog 필터뷰. 사이드바 구성=Space 컬럼. **PUBLIC 편집=로그인 사용자(암묵적 Editor)** → 기존 편집 동작 회귀 없음. PRIVATE 만 멤버/역할 제한.
- **변경 파일**:
  - `schema.prisma` + 마이그레이션 `20260529010000_space_permissions` — `enum SpaceRole/SpaceVisibility`, `model SpaceMember(@@id[spaceId,userId])`, `Space.visibility(@default PUBLIC)`+members, `User.spaceMemberships`. 백필: PERSONAL→visibility=PERSONAL
  - `spaces/space-permission.service.ts` 신규 — `canView/canEdit/canManage`(전역 ADMIN override·PUBLIC·PRIVATE·PERSONAL) + assert 헬퍼 + `space/pageVisibilityWhere` 필터. `space-permission.module.ts`(PrismaModule @Global)
  - `spaces.service.create` — 생성자 actor→`SpaceMember(ADMIN)` 자동 등록. `findAll(actor)` → `spaceVisibilityWhere` 기반(visibility 전환)
  - `pages.service` — `findOne(id, actor)` canView assert(403), `recent({..., actor})` `pageVisibilityWhere` 필터
  - `pages.controller` — `@Get('recent')`/`@Get(':id')` 에 `OptionalJwtAuthGuard` + actor 전달. `spaces.controller.findAll` actor 전달
  - `space-permission.service.spec` 신규(권한 매트릭스 전수) + `pages.service.spec` 권한 서비스 mock 주입
- **검증**: ⚠️ **`cd apps/api && npx prisma migrate deploy`** + `npx prisma generate` 적용 필수. api `tsc --noEmit` EXIT 0, jest **140 passed (14 suites)**(권한 spec 신규)
- **현재 효과(회귀 없음)**: 기존 스페이스 전부 PUBLIC → 가드/필터 사실상 no-op. **개선**: 타인 PERSONAL 페이지가 `/home 최근`·`findOne`·`스페이스 목록`에서 더 이상 노출되지 않음(기존 프라이버시 누수 차단)
- **74-A followup (완료)**: 읽기 필터를 전 목록 엔드포인트에 확장(`findAll`/`search`/`full-search` 가시성 필터 + `board` canView assert), 쓰기 assert 를 전 mutation 컨트롤러에 적용(`create`=canEdit(spaceId), `update`/`draft`/`publish`/`remove`/`restore`/`permanentDelete`/`copy`/`restoreVersion`/`createDiagram`=`assertCanEditPage`). **무가드였던 `createDiagram`·`restoreVersion` 에 JwtAuthGuard 추가**(기존 구멍 차단). `changeStatus` 는 Cycle 70 임시 가드(작성자/ADMIN) 유지. api jest 140 passed.
- **남은 일**: 멤버 CRUD·마지막 Admin 보호=74-C. 첨부 업로드/삭제(attachments.controller) 쓰기 가드 + `listTrash`/`listDiagrams`/`listVersions` 읽기 필터는 소규모 후속(현재 PUBLIC 이라 무영향). 메가 사이클: 74-B 진입점+개요 / C 권한 / D 감사로그 / E 페이지순서 / F 사이드바구성 / G 아이콘. **브라우저 시각 확인 미수행**
- **비고**: 권한 판정은 `SpacePermissionService` 단일 출처. 페이지 상태(Cycle 70) '작성자+ADMIN' 임시 가드는 이번엔 그대로 유지(별도 교체). CLAUDE.md 갱신은 메가 사이클(74) 완료 시 일괄(현재 모델 진화 중).

---

## Cycle 74-B — 2026-05-29 — ✅ Done (공간 도구 진입점 + 개요 탭)
- **제목**: 권한 기반(74-A) 위에 '공간 도구' 화면 도입 — 진입점 + 개요 탭(이름/설명/공개범위/삭제)
- **카테고리**: BE + FE / 기능 (스페이스 관리)
- **커밋**: `e79dbb8`(74-B 코드), 본 CYCLES.md
- **변경 파일 (BE)**:
  - `spaces.service.ts` — `findAll` 에 현재 사용자 membership role include(공간 도구 노출 판정용). `updateSettings(id,dto,user)`=`assertCanManage` + 이름/설명/visibility 갱신(PERSONAL visibility 변경 금지). `remove(id,user)`=`assertCanManage` + `space.delete`(FK Cascade)
  - `spaces.controller.ts` — `PATCH /spaces/:id/settings`, `DELETE /spaces/:id`(JwtAuthGuard, canManage 는 service)
  - `dto/update-space-settings.dto.ts` 신규 — visibility 는 PUBLIC|PRIVATE 만
- **변경 파일 (FE)**:
  - `lib/types.ts` — `SpaceVisibility`/`SpaceRole` + `Space.visibility`/`members`. `lib/spacePermission.ts` 신규 — `canManageSpace`(전역 ADMIN/PERSONAL 소유자/멤버 ADMIN)
  - `Sidebar.tsx` — '공간 도구' 버튼을 `canManage && SITE` 에만 노출 + `?view=settings` 이동
  - `page.tsx` — `view=settings` 분기(board 와 동일 가드)
  - `SpaceSettings.tsx` 신규 — 탭바(개요 활성, 권한/감사로그/페이지순서/사이드바구성 '준비 중' 비활성) + 개요 탭(이름/설명/공개범위 토글/이름 입력 확인식 삭제). 비-canManage 접근 시 안내
- **검증**: web/api `tsc --noEmit` EXIT 0, jest **140 passed**. **마이그레이션 없음**(74-A 스키마 재사용)
- **동작 확인 안내**:
  1) **마이그레이션 불필요**. dev 서버 재기동 필요(74-A 에서 Prisma generate 위해 API 종료함)
  2) SITE 공간에서 Space Admin/전역 ADMIN 이면 사이드바 하단 '⚙️ 공간 도구' 노출(그 외엔 DOM 미생성)
  3) 클릭 → 개요 탭. 이름/설명 저장, 공개범위 PUBLIC↔PRIVATE 저장
  4) 삭제: 공간 이름 입력 + 확인 → 삭제 후 /home 이동
  5) 비-관리자가 URL 직접 진입(`?view=settings`) → "권한 없음" 안내. 백엔드 PATCH/DELETE 는 canManage 로 403
- **남은 일**: 74-C 권한(멤버 CRUD + 마지막 Admin 보호) / D 감사로그 / E 페이지순서 / F 사이드바구성 / G 아이콘. PRIVATE 전환이 이제 가능해졌으므로 멤버 관리(74-C)가 자연스러운 다음 순서. spaces.service.updateSettings/remove 단위 spec 미추가(canManage 매트릭스는 space-permission spec 이 커버). **브라우저 시각 확인 미수행**
- **비고**: '공간 도구'는 PERSONAL 공간엔 미노출(개인 공간은 관리 대상 아님). 기존 SITE 공간은 멤버 0명이라 **전역 ADMIN 만** 공간 도구 접근 — 신규 생성 공간은 생성자가 ADMIN 멤버라 접근 가능.

---

## Cycle 74-C — 2026-05-29 — ✅ Done (공간 도구 권한 탭 — 멤버 CRUD)
- **제목**: 스페이스 멤버 관리(추가/역할변경/제거) + 마지막 Admin 보호. 공간 도구 '권한' 탭.
- **카테고리**: BE + FE / 권한 (멤버십 관리)
- **커밋**: `1b36f46`(74-C 코드), 본 CYCLES.md
- **변경 파일 (BE)**:
  - `spaces.service.ts` — `listMembers`/`addMember`(upsert·idempotent)/`updateMemberRole`/`removeMember`, 각 `assertCanManage`. **마지막 ADMIN 강등·제거 방지**(`assertNotLastAdmin`: `spaceMember.count(role=ADMIN)<=1` 이면 BadRequest)
  - `spaces.controller.ts` — `GET/POST /spaces/:id/members`, `PATCH/DELETE /spaces/:id/members/:userId`(JwtAuthGuard)
  - `dto/add-member.dto.ts`·`update-member-role.dto.ts` 신규. 멤버 검색은 기존 `GET /api/users?q=` 재활용
  - `spaces.service.spec.ts` 신규 — 마지막 Admin 보호·upsert·NotFound·EDITOR 제거 허용
- **변경 파일 (FE)**:
  - `SpaceMembersPanel.tsx` 신규 — 멤버 목록(이름/부서/역할/추가일) + `UserSearchCombobox`(Cycle 73 재활용) 추가 + 역할 변경 select + 제거 확인. 마지막 Admin 400 → 안내 메시지 변환
  - `SpaceSettings.tsx` — 탭 전환(`activeTab`) + '권한' 탭 활성화(개요는 display 토글로 상태 보존)
- **검증**: web/api `tsc --noEmit` EXIT 0, jest **147 passed (15 suites)**. **마이그레이션 없음**(74-A 스키마 재사용)
- **동작 확인 안내**:
  1) **마이그레이션 불필요**. dev 서버 재기동 필요
  2) 공간 도구 → '권한' 탭 → 멤버 목록
  3) '+ 사용자 검색' → 역할 선택 → 추가(이미 멤버면 역할 갱신)
  4) 역할 드롭다운 변경 / 제거 동작, 즉시 갱신
  5) **마지막 관리자**를 강등/제거 시도 → 막힘 + 안내(서버 400)
  6) 비-canManage 사용자의 멤버 API 직접 호출 → 403
- **남은 일**: 74-D 감사로그 / E 페이지순서 / F 사이드바구성 / G 아이콘. **브라우저 시각 확인 미수행**
- **비고**: 멤버 추가/역할변경 시 `["spaces"]` 도 invalidate → 본인 역할 변동이 사이드바 '공간 도구' 노출에 즉시 반영. 전역 ADMIN 은 멤버 0명이어도 관리 가능(override) — 멤버 목록이 비어도 정상.
- **74-C followup**: '공간 도구'를 클릭 시 라우팅 대신 **위로 열리는 드롭다운 메뉴**(개요/권한 + 준비중 항목)로 변경. 항목 선택 → `?view=settings&tab=<id>` → `SpaceSettings` 가 `?tab=` 으로 초기 탭 결정. 외부클릭/Esc 닫힘. (`59e9d8b`)
- **운영 메모(데드락 해소)**: 기존 SITE 공간은 백필상 멤버 0명이라 전역 ADMIN(`admin1`)만 공간 도구 접근 가능. 테스트 계정(`testuser`=DEVELOPER)을 쓰려면 멤버 시드 필요 → 기존 6개 SITE 공간에 testuser 를 SpaceMember(ADMIN) 로 일회성 INSERT 함(추가 전용). 전역 ADMIN 승격은 Keycloak realm role 필요(DB role 은 로그인마다 동기화돼 리셋).

---

## Cycle 74-D — 2026-05-29 — ✅ Done (공간 도구 감사 로그 탭)
- **제목**: ActivityLog 를 스페이스 단위로 필터링한 감사 로그 뷰(옵션 A — 신규 모델 없음)
- **카테고리**: BE + FE / 기능 (감사 로그)
- **커밋**: `3989544`(74-D 코드), 본 CYCLES.md
- **변경 파일 (BE)**:
  - `activities.service.ts` — `list` 에 `dateFrom`/`dateTo`(createdAt gte/lte) 필터
  - `spaces.service.ts` — `getAuditLog(id,opts,user)` = `assertCanManage` + `activities.list({spaceId,...})`
  - `spaces.controller.ts` — `GET /spaces/:id/audit`(type/actorId/dateFrom/dateTo/limit/offset)
  - `activities.service.spec.ts` — 날짜 필터 3종
- **변경 파일 (FE)**:
  - `SpaceAuditPanel.tsx` 신규 — 이벤트 타입(`ACTIVITY_TYPES`)/기간(from~to)/사용자(`UserSearchCombobox`) 필터 + '더 보기' 페이지네이션 + `formatActivity` 목록
  - `SpaceSettings.tsx`/`Sidebar.tsx` 드롭다운에 '감사 로그' 탭 활성화(`?tab=audit`)
- **검증**: web/api `tsc --noEmit` EXIT 0, jest **150 passed (15 suites)**. **마이그레이션 없음**
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 공간 도구 드롭다운/탭 → '감사 로그'
  3) 이벤트 타입/기간/사용자 필터 조합 → 결과 즉시 갱신, '더 보기' 페이지네이션
  4) 페이지 항목 클릭 → 해당 페이지 이동
  5) 비-canManage 의 `GET /spaces/:id/audit` 직접 호출 → 403
- **남은 일**: 74-E 페이지 순서 / F 사이드바 구성 / G 아이콘 업로드. **브라우저 시각 확인 미수행**
- **비고**: 감사 로그는 ActivityLog 재활용이라 기록되는 활동(page.created/published/moved/copied/soft_deleted/restored/permanent_deleted/status_changed/comment.created)만 노출. 멤버/권한 변경 활동 로그는 미기록 — 필요 시 별도 type 추가(후속).
- **74-D followup**: ① 감사 로그를 **날짜·작성자·분류·요약 4열 표**로 변경. ② 내용 편집이 발행으로만 남아 생성/수정이 안 갈리던 문제 → publish() 가 **이미 발행됐던 페이지의 재발행을 `page.updated`('페이지 수정')** 로 로깅(첫 발행만 `page.published`). ActivityType union + activity-format 라벨/케이스 추가. (`565e747`) 과거 데이터는 소급 변경 없음.

---

## Cycle 74-E — 2026-05-29 — ✅ Done (공간 도구 페이지 순서 탭)
- **제목**: 스페이스 페이지 트리 형제 순서 드래그 재정렬(즉시 저장)
- **카테고리**: FE / 기능 (페이지 순서)
- **커밋**: `b0217b3`(74-E 코드), 본 CYCLES.md
- **변경 파일 (FE 전용)**:
  - `SpacePageOrderPanel.tsx` 신규 — 발행 페이지 트리를 들여쓰기 flat 리스트로 표시, `@dnd-kit/sortable` 로 **같은 상위 페이지 안에서** 순서 변경 → `PATCH /pages/:id {position}` 즉시 반영 + `["spaces"]` invalidate. 다른 상위로 드롭은 안내 후 무시
  - `SpaceSettings.tsx`/`Sidebar.tsx` 드롭다운에 '페이지 순서' 탭 활성화(`?tab=order`)
- **BE 변경 없음**: 기존 `pages.update` 의 position 정규화(형제 그룹 재부여, Cycle 19a) 재활용. canEdit 가드(74-A)가 PATCH 를 보호
- **검증**: web `tsc --noEmit` EXIT 0. 마이그레이션 없음
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 공간 도구 → '페이지 순서' 탭 → 트리 표시
  3) 같은 상위 안에서 드래그 → 순서 변경 즉시 저장(사이드바 트리에도 반영)
  4) 다른 상위로 드롭 → "같은 상위 안에서만" 안내
- **남은 일**: 계층(재부모) 변경은 이 탭에선 미지원(사이드바 트리 DnD 사용). 74-F 사이드바 구성 / 74-G 아이콘 업로드. **브라우저 시각 확인 미수행**
- **비고**: 단일 `SortableContext`(flat ids) + dragEnd 에서 같은 parentId 일 때만 형제 인덱스로 PATCH. 계층 재부모는 사이드바가 이미 지원하므로 중복 구현 회피.
- **74-E followup (피드백 반영)**: ① **홈(메인 페이지)을 최상단에 🏠 고정**(드래그/버튼 비활성), 트리는 실제 parentId 구조 그대로(승격 없이) 표시 — 편집 도구라 raw 구조가 명확. ② **계층(재부모) 지원 추가** — `→`(바로 위 형제의 하위로, parentId=prevSibling) / `←`(상위 밖으로, parentId=조부모) 버튼. 드래그는 같은 상위 순서 변경 유지. PATCH parentId 의 cycle/스페이스 일치 가드는 백엔드 `pages.update` 가 처리. (`69c1611`)
- **74 followup**: **개인 공간에도 '공간 도구' 노출**(소유자=canManageSpace). 단 개인 공간은 멤버 모델 부적합 → '권한' 탭 + 삭제 섹션 제외(개요/감사로그/페이지순서만). (`017d391`)

---

## Cycle 74-F — 2026-05-29 — ✅ Done (공간 도구 사이드바 구성 — 스페이스 바로가기)
- **제목**: 스페이스별 사이드바 바로가기(내부 페이지/외부 URL) 관리 + 사이드바 표시
- **카테고리**: BE + FE / 기능 (사이드바 구성)
- **커밋**: `62671f5`(74-F 코드), 본 CYCLES.md
- **마이그레이션**: `20260529020000_space_shortcut` (enum SpaceShortcutType, model SpaceShortcut, Space.shortcuts). migrate dev 가 EOL 드리프트로 리셋 요구 → 수기 마이그레이션 + `migrate deploy` 비파괴 적용
- **변경 파일 (BE)**:
  - `schema.prisma` — `enum SpaceShortcutType(INTERNAL_PAGE|EXTERNAL_URL)`, `model SpaceShortcut{id,spaceId,type,label,target,position}`, `Space.shortcuts`
  - `spaces.service.ts` — `addShortcut`/`updateShortcut`/`removeShortcut`/`reorderShortcuts`(각 canManage). 외부 URL `isSafeHttpUrl`(http/https 만), 내부 페이지는 해당 공간 소속 검증. `findAll` include 에 shortcuts(position asc)
  - `spaces.controller.ts` — `POST/PATCH/DELETE /spaces/:id/shortcuts[/:shortcutId]` + `PATCH .../reorder`(:shortcutId 위에 선언)
  - `dto/shortcut.dto.ts` 신규. `spaces.service.spec` — URL 스킴 차단·내부 페이지 검증·reorder
- **변경 파일 (FE)**:
  - `SpaceSidebarConfigPanel.tsx` 신규 — 바로가기 추가(내부=공간 페이지 select/외부=URL)+삭제+위/아래 순서(reorder)
  - `Sidebar.tsx` — '바로가기' 섹션 렌더(내부=페이지 이동 onSelect, 외부=새 탭 `rel=noopener noreferrer`). 드롭다운 '사이드바 구성' 탭 활성화
  - `SpaceSettings.tsx` — '사이드바 구성' 탭 enabled + 패널 렌더. `lib/types` SpaceShortcut(Type) + `shortcuts`
- **검증**: web/api `tsc --noEmit` EXIT 0, jest **154 passed (15 suites)**
- **동작 확인 안내**:
  1) ⚠️ **`cd apps/api && npx prisma migrate deploy`** + `npx prisma generate` (적용 완료, dev 서버 재기동 필요)
  2) 공간 도구 → '사이드바 구성' → 내부 페이지/외부 URL 바로가기 추가, 위/아래 순서, 삭제
  3) 사이드바에 '바로가기' 섹션 노출(내부=페이지 이동, 외부=새 탭)
  4) 외부 URL 에 `javascript:` 등 비-http(s) → 400(차단). 다른 공간 페이지를 내부 바로가기로 → 400
  5) 비-canManage 의 shortcut API 직접 호출 → 403
- **남은 일**: '표시 항목 토글(페이지 트리/최근 활동/즐겨찾기)·트리 표시 방식' 은 현재 사이드바에 해당 토글 섹션이 없어 미구현(필요 시 별도). 74-G 스페이스 아이콘 이미지 업로드. **브라우저 시각 확인 미수행**
- **비고**: 바로가기 목록은 `GET /spaces`(findAll) include 로 제공(별도 fetch 없이 사이드바·설정 패널 공유). 멤버 공통(Space 종속, 사용자별 아님 — 사이드바 구성 저장 위치 옵션 A).
- **74-F followup (피드백 반영)**: 바로가기가 새 '바로가기' 섹션이 아니라 사이드바의 **기존 '공간 바로가기' 섹션**에 표시되도록 변경(별도 섹션 신설 회피). (`1006741`)

---

## Cycle 74-G — 2026-05-29 — ✅ Done (스페이스 아이콘)
- **제목**: 스페이스 아이콘(이모지 또는 이미지 data URL) 설정 + 목록/사이드바 표시
- **카테고리**: BE + FE / 기능 (스페이스 아이콘) — mega-cycle 74 마지막 서브사이클
- **커밋**: `84b4eb2`(74-G 코드), 본 CYCLES.md
- **마이그레이션**: `20260529030000_space_icon` (`Space.icon TEXT` nullable). migrate dev 가 EOL 드리프트로 리셋 요구 → 수기 마이그레이션 + `migrate deploy` 비파괴 적용 + `prisma generate`(API 프로세스 종료 후 DLL 잠금 해제)
- **변경 파일 (BE)**:
  - `schema.prisma` — `Space.icon String?`
  - `dto/update-space-settings.dto.ts` — `icon?: string | null` (`@MaxLength(300000)`)
  - `spaces.service.ts` — `updateSettings` 가 icon 수용. 검증: 빈 값=제거(null), 그 외엔 `data:image/` 접두 **또는** 길이 ≤16(이모지)만 허용, 위반 시 400
- **변경 파일 (FE)**:
  - `SpaceSettings.tsx` — 개요 탭 '아이콘' 필드: 미리보기 + 이모지 프리셋 10종 + '이미지 업로드'(canvas 로 128px 리사이즈 → data URL) + '제거'. 저장 시 `icon` 포함
  - `lib/types.ts` — `SpaceWithPages.icon?: string | null`
  - `app/(app)/spaces/page.tsx`·`Sidebar.tsx` — 아바타: `data:` 면 `<img>`, 짧은 문자면 이모지 span, 없으면 기존 이니셜 색상 박스 폴백
- **검증**: web/api `tsc --noEmit` EXIT 0, jest **154 passed (15 suites)**
- **동작 확인 안내**:
  1) ⚠️ **`cd apps/api && npx prisma migrate deploy`** + `npx prisma generate` (적용 완료, **dev 서버 재기동 필요** — generate 위해 API 프로세스 종료했음)
  2) 공간 도구 → 개요 → 아이콘: 이모지 선택/이미지 업로드/제거 → '저장'
  3) 스페이스 목록(`/spaces`)·스페이스 사이드바 헤더 아바타에 아이콘 반영
  4) 비정상 icon(긴 비-data 문자열) PATCH → 400
- **남은 일**: 없음 — **mega-cycle 74 완료**. (브라우저 시각 확인 미수행 — dev 서버 재기동 후 확인 권장)
- **비고**: 이미지는 첨부(page 종속)와 분리해 Space 행에 data URL 로 직접 저장(서빙 경로 불필요). 클라에서 128px 로 리사이즈해 용량 억제(DTO 상한 300KB).
- **74-G followup (피드백 반영)**: 아이콘이 일부 화면에만 반영되던 문제 → **공유 `SpaceAvatar` 컴포넌트** 신설(data:image→`<img>` / 이모지 / 이름 이니셜 폴백, size prop). 홈 '내 공간'(`SystemSidebar` 펼침/접힘), 검색 오버레이(필터 팝오버+결과), `TopNav` 공간 드롭다운, `/spaces` 목록, 스페이스 사이드바 헤더 — **공간 아바타 6곳 전부**를 동일 컴포넌트로 통일(사용자 아바타는 대상 외). (`dd455c7`)

---

## Cycle 75 — 2026-05-29 — ✅ Done (공간 도구 개요/권한 탭 UX 개선)
- **제목**: 개요 탭 보기/편집 모드 분리 + 삭제 버튼 분리, 권한 탭 멤버 다중 선택 제거
- **카테고리**: FE 전용 / UX (공간 도구)
- **커밋**: `f193b6b`(코드), 본 CYCLES.md
- **변경 파일 (FE 전용)**:
  - `SpaceSettings.tsx` — 개요 탭을 **보기 모드(기본)** ↔ **편집 모드** 로 분리. 보기 모드는 아이콘/이름/설명/공개범위를 읽기 전용 표시 + `스페이스 세부 정보 편집` 버튼. 편집 모드는 기존 입력 폼(아이콘 피커/이름/설명/공개범위) + `저장`/`취소`(취소 시 서버값 복원, `resetDetails`). 저장 성공 시 보기 모드 복귀. **삭제는 별도 `스페이스 삭제` 버튼**으로 분리 — 클릭 시에만 이름 확인 박스(+`취소`) 노출(`showDelete`). 개인 공간은 삭제 섹션/공개범위 제외 유지
  - `SpaceMembersPanel.tsx` — 멤버 표에 **체크박스 열 + 헤더 전체 선택**. 1명 이상 선택 시 상단 `선택 제거 (N)` 버튼 활성 → 순차 DELETE(`removeBulk`), 서버가 막는 마지막 관리자 등은 건너뛰고 실패 건수 알림. 성공 시 선택 초기화. 기존 행별 `제거`/역할 변경/`멤버 추가` 는 그대로 유지
- **BE 변경 없음**: 기존 `PATCH /spaces/:id/settings`, `DELETE /spaces/:id`, `DELETE /spaces/:id/members/:userId` 재사용. 마지막 관리자 보호(서버 400)도 그대로
- **검증**: web `tsc --noEmit` EXIT 0, jest **154 passed (15 suites)**. 마이그레이션 없음
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 공간 도구 → 개요: 처음엔 읽기 전용 → `스페이스 세부 정보 편집` → 이름/설명/아이콘/공개범위 수정 → `저장`(또는 `취소`)
  3) 개요 하단 `스페이스 삭제` → 이름 확인 입력 → `삭제`(개인 공간은 버튼 없음)
  4) 권한: 멤버 체크 → `선택 제거 (N)` → 확인 → 일괄 제거(마지막 관리자만 남기면 그 건은 실패 알림)
- **남은 일**: 없음. **브라우저 시각 확인 미수행**
- **비고**: 일괄 제거는 단건 DELETE 를 순차 호출(전용 bulk 엔드포인트 미신설 — 멤버 수가 적어 충분). 마지막 관리자 제약은 서버가 요청별로 판정하므로 일부만 실패할 수 있어 실패 건수를 집계해 안내.
- **75 followup (피드백 반영)**: 개인 공간에서 **권한 탭과 삭제 버튼이 안 보인다**는 보고 → 개인 공간을 제외하던 가드 제거(`visibleTabs=TABS`, permissions 폴백 useEffect 삭제, 삭제 섹션 `type!=="PERSONAL"` 가드 삭제). 백엔드 `remove`/멤버 관리는 원래 `canManage`(소유자)만 검사해 개인 공간에서도 동작 → **FE 변경만**. 단 개인 공간 멤버 추가는 권한 모델상 실제 접근을 부여하지 않음(표시용), 개인 공간 삭제는 다음 OIDC 로그인 시 `getOrCreatePersonal` 로 **빈 공간 자동 재생성**(페이지는 복구 불가) — 삭제 확인 박스에 안내 문구 추가. (`892e9aa`) 이전 `017d391`(개인 공간 권한/삭제 제외) 결정을 사용자 요청으로 되돌림.

---

## Cycle 76 — 2026-05-29 — ✅ Done (공간 도구/사이드바/편집 UX 6종)
- **제목**: 개인 공간 권한 부트스트랩 · 댓글 위치 · 사이드바 설명 · 편집 모드 TopNav · 내 공간 버튼 · 홈 트리 표시
- **카테고리**: BE + FE / UX 묶음 (사용자 6항목 요청)
- **커밋**: `d319d2b`(코드), 본 CYCLES.md
- **항목별 변경**:
  - **0. 개인 공간 권한**: `getOrCreatePersonal` 가 소유자를 `SpaceMember(ADMIN)` 로 부트스트랩(신규 create + 기존은 매 로그인 upsert 백필). 기존 개인 공간 3개는 1회 스크립트로 즉시 백필. `Sidebar` '공간 도구' 드롭다운에서 개인 공간일 때 '권한' 항목 제외하던 필터 삭제(`toolItems=SPACE_TOOL_ITEMS`)
  - **1. 댓글 최하단**: `page.tsx` 조회 모드에서 '👍 처음으로 좋아하는…' + '🏷️ 레이블 없음' 줄을 본문 컬럼 안 `ReactionBar` 와 `PageComments` 사이로 이동 → 댓글이 페이지 최하단
  - **2. 사이드바 설명 제거**: `Sidebar` 공간 헤더에서 `space.description` 줄 삭제(이름만)
  - **3. 편집 모드 TopNav**: `FullScreenEditor`(fixed z-40)가 `TopNav` 드롭다운(공간/아바타, z-30)을 덮던 문제 → `TopNav` 루트 `<header>` 에 `relative z-50` 부여(에디터 위 스택)
  - **4. '+ 내 공간 추가' 제거**: `SystemSidebar` '내 공간' 헤더의 personal space 토글 버튼 + `togglePersonalSpace` 뮤테이션 + 미사용 import(`useMutation`/`useQueryClient`/`apiFetch`) 정리
  - **5. 홈 트리 표시 + 미지정 안내**: `Sidebar` 트리에서 홈 제외·자식 승격하던 로직 폐기 → 홈도 트리에 표시(`treePages=발행 페이지 전체`). 홈 식별은 **지정된 `homePageId` 만**(첫 루트 fallback 폐기) → 미지정 시 '홈' 클릭하면 안내 alert
- **검증**: web/api `tsc --noEmit` EXIT 0, jest **154 passed (15 suites)**. 스키마/마이그레이션 변경 없음(SpaceMember 재사용)
- **동작 확인 안내**:
  1) **마이그레이션 불필요**(개인 공간 멤버는 스크립트로 백필 완료)
  2) 개인 공간 → 공간 도구 드롭다운에 '권한' 노출, 권한 탭에 소유자가 ADMIN 으로 표시
  3) 페이지 조회 시 댓글이 좋아요/레이블 줄 아래(최하단)
  4) 사이드바 공간 헤더에 설명 미표시
  5) 편집 모드에서 상단 '공간'/아바타 클릭 → 드롭다운이 에디터 위로 보임
  6) 홈 사이드바에 '+ 내 공간 추가' 버튼 없음
  7) 페이지 트리에 홈(Main Page) 노출, 홈 미지정 공간에서 '홈' 클릭 시 안내
- **남은 일**: 없음. **브라우저 시각 확인 미수행**(dev 서버 재기동 후 권장)
- **비고**: 홈 미지정 시 홈 지정 UI 는 이번 범위 밖(안내만). 개인 공간 멤버 추가는 여전히 권한 모델상 실제 접근 부여 안 함(표시용) — 75 followup 비고와 동일.
- **76 followup (피드백 반영)**: `Sidebar` 공간 헤더의 **공간 이름을 클릭 가능한 버튼**으로 변경 → 클릭 시 홈 페이지 이동. 홈 진입 로직을 `goHome` 으로 추출해 '홈' NavItem 과 공유(홈 미지정 시 동일 안내 alert). (`3f176e2`)

---

## Cycle 77 — 2026-05-29 — ✅ Done (좋아요 placeholder 제거 + 트리 호버 버튼 제거)
- **제목**: 페이지 조회 좋아요 문구 제거, 사이드바 페이지 트리 행 ＋/× 호버 버튼 제거
- **카테고리**: FE 전용 / UX (사용자 2항목)
- **커밋**: `c7516cb`(코드), 본 CYCLES.md
- **변경 파일 (FE 전용)**:
  - `page.tsx` — 조회 모드의 '👍 처음으로 좋아하는 사람이 돼볼까요?' 줄 제거(이미 `ReactionBar` 이모지 반응이 있어 중복). '🏷️ 레이블 없음' 만 댓글 위에 유지(우측 정렬)
  - `Sidebar.tsx` — `SortableTreeRow` 의 마우스오버 ＋(하위 페이지 추가)/×(삭제) 버튼 제거. 이로 인해 dead 가 된 `onCreatePage`/`onRequestDelete` 행 prop, `deleteReq` 상태, `DeletePageDialog` 마운트/임포트 정리. `Props.onCreatePage`/`onDeletePage` 는 셸(layout)이 계속 제공하므로 타입은 유지(향후 재사용 여지)
- **검증**: web `tsc --noEmit` EXIT 0, jest **154 passed (15 suites)**. 마이그레이션 없음
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 페이지 조회 하단: 좋아요 문구 없음, 이모지 반응 바 + (레이블 줄) + 댓글 순
  3) 사이드바 페이지 트리에서 행 마우스오버 시 ＋/× 안 뜸(펼침/접기 화살표는 유지)
- **남은 일**: 없음. **브라우저 시각 확인 미수행**
- **비고**: 페이지 생성은 TopNav '만들기', 삭제는 페이지 헤더 MoreMenu 로 계속 가능(트리 행 버튼만 제거). 트리 DnD 순서 변경/펼치기는 그대로.

---

## Cycle 78 — 2026-05-29 — ✅ Done (공간 디렉터리/페이지순서/아이콘 기본값 + 페이지 레이블)
- **제목**: /spaces 비활성 탭 제거 · 페이지순서 홈 조작 · 개요 아이콘 기본값 · 페이지 레이블 기능
- **카테고리**: BE + FE / UX + 기능 (사용자 4항목)
- **커밋**: `36628e8`(코드), 본 CYCLES.md
- **마이그레이션**: `20260529040000_page_labels` (`Page.labels TEXT[] DEFAULT '{}'`). 수기 마이그레이션 + `migrate deploy` 비파괴 적용 + `prisma generate`(API nest-watch/main 프로세스 종료 후 DLL 잠금 해제)
- **항목별 변경**:
  - **1. 비활성 탭 제거**: `spaces/page.tsx` 의 `TabId`/`TAB_LABELS`/`TABS` 에서 '개인 공간'(personal)·'보관된 공간'(archived) 제거 + 필터/EmptyState 분기 정리
  - **2. 페이지 순서 홈 조작**: `SpacePageOrderPanel` 에서 홈 핀(루트 최상단 고정) 제거, `useSortable` 의 `disabled: isHome` 제거, onDragEnd 의 `isHome` 가드 제거, `sortableIds` 에 홈 포함 → 홈도 드래그/들여쓰기 가능. 행에 🏠 + (홈) 표시는 유지
  - **3. 아이콘 기본값**: `SpaceSettings` 개요 탭(보기/편집) 아이콘 미리보기를 `📄` 회색 placeholder 대신 **`SpaceAvatar`** 로 → 커스텀 아이콘 없으면 파란 배경 + 이름 첫 글자(실제 기본 아바타) 표시
  - **4. 페이지 레이블**: `Page.labels String[]` 추가. `UpdatePageDto.labels?` (`@IsArray`/`@IsString({each})`) + 서비스 `normalizeLabels`(trim/빈값 제거/라벨 50자/중복 대소문자 무시/최대 20개). `findOne` 은 include 라 scalar 자동 반환. `LabelBar` 컴포넌트 신설(칩 + × 제거 + '＋ 레이블 추가' 팝업, PATCH 낙관 갱신). `page.tsx` 조회 화면에서 **레이블(좌) + 이모지 반응(우)을 같은 줄**(justify-between)에 배치, 기존 '🏷️ 레이블 없음' 푸터 제거. `ReactionBar` 루트의 `mt-2` 제거(정렬용) → 댓글 쪽은 wrapper `mt-2` 로 보존. `lib/types` `PageFull.labels?`
- **검증**: web/api `tsc --noEmit` EXIT 0, jest **154 passed (15 suites)**
- **동작 확인 안내**:
  1) ⚠️ **`cd apps/api && npx prisma migrate deploy`** + `npx prisma generate` (적용 완료, **API dev 서버 재기동 필요** — generate 위해 nest-watch/main 종료함)
  2) /spaces 상단 탭: 모든/사이트/내 공간 3개만
  3) 공간 도구 → 페이지 순서: 홈도 드래그/→/← 가능, 🏠 (홈) 표시
  4) 공간 도구 → 개요: 커스텀 아이콘 없으면 파란 배경 첫 글자 미리보기
  5) 페이지 조회 하단: 레이블 칩 + '＋ 레이블 추가'(팝업) 와 이모지 반응이 같은 줄, 그 아래 댓글
- **남은 일**: 없음. **브라우저 시각 확인 미수행**
- **비고**: 레이블은 페이지 로컬 `String[]`(공간 전역 레이블/검색·필터는 범위 밖). PATCH `/pages/:id { labels }` 는 기존 가드(`assertCanEditPage`)로 보호. `public/icons` 의 신규 에셋(background/image/palette)은 본 커밋에 미포함(출처 불명 — 사용자 확인 필요).

---

## Cycle 79 — 2026-05-29 — ✅ Done (페이지순서 홈 조작 + Drop 상태 + 툴바 아이콘/문단)
- **제목**: 페이지순서 홈 들여쓰기 · 페이지 상태 Drop · 에디터 툴바 아이콘 교체 · 제목 드롭다운 문단
- **카테고리**: BE + FE / UX + 기능 (사용자 4항목)
- **커밋**: `56f4ff4`(코드), 본 CYCLES.md
- **마이그레이션**: `20260529050000_page_status_drop` (`ALTER TYPE "PageStatus" ADD VALUE 'DROP'`). 수기 + `migrate deploy` + `prisma generate`(API nest-watch/main 종료 후)
- **항목별 변경**:
  - **0. 페이지순서 홈 조작**: `SpacePageOrderPanel` 들여쓰기(→)를 **'인접 형제의 하위로'** 로 일반화 — 이전 형제가 있으면 그 하위로, 첫 항목(홈 등)은 **다음 형제**의 하위로. `canIndent = sibs.length > 1`(첫 항목도 형제만 있으면 가능). 홈 핀은 78에서 이미 제거, 🏠/(홈) 표시 유지. 도움말/버튼 title 을 위치 무관 문구로
  - **1. Drop 상태**: `PageStatus` enum + `lib/types`/`PageStatusBadge.STATUS_META`(붉은 톤)/`PageStatusDropdown.OPTIONS`/`StatusFilterChips.FILTERS`/`KanbanBoard.COLUMNS`+grouped/`activity-format.STATUS_LABEL`/`pages.controller.parseStatuses` valid set 에 DROP 추가. status PATCH DTO 는 `@IsEnum(PageStatus)` 라 자동 수용
  - **2. 툴바 아이콘**: `AppIcon` 에 palette/background/image/table 등록. `EditorColorPicker` 트리거 🎨/🖍️ → palette.svg(텍스트색)/background.png(배경색). `EditorToolbar` 이미지 🖼️ → image.png, 표 ▦ → table.png + ▼(크기 선택 팝업 동반 표시). 에셋 `public/icons/{palette.svg,background.png,image.png,table.png}` 커밋 포함
  - **3. 문단 항목**: `ParagraphStyleDropdown` items 맨 앞에 '문단'(setParagraph, active=현재 라벨이 문단) 추가
- **검증**: web/api `tsc --noEmit` EXIT 0, jest **154 passed (15 suites)**
- **동작 확인 안내**:
  1) ⚠️ **`cd apps/api && npx prisma migrate deploy`** + `npx prisma generate` (적용 완료, **API dev 서버 재기동 필요**)
  2) 공간 도구 → 페이지 순서: 홈의 → 버튼으로 다음 페이지 하위로 들여쓰기, ← 로 복귀
  3) 페이지 상태/칸반/목록 필터에 Drop(붉은 배지) 노출 + 변경
  4) 편집 툴바: 텍스트색/배경색/이미지/표 아이콘 교체, 표는 ▼ 동반
  5) 제목 드롭다운에 '문단' 노출(제목/인용에서 문단 복귀)
- **남은 일**: 없음. **브라우저 시각 확인 미수행**
- **비고**: 들여쓰기 일반화는 홈뿐 아니라 모든 '첫 형제'에 적용(다음 형제 하위로) — 일관성 유지. `public/icons/checkbox.png`(untracked)는 본 작업과 무관해 미포함.

---

## Cycle 80 — 2026-05-29 — ✅ Done (공간 만들기 / 만들기 모달 — prompt 제거)
- **제목**: '공간 만들기' 모달(이름/스페이스 키/설명) + '만들기' 모달(빈 페이지 카드)
- **카테고리**: BE + FE / UX (네이티브 prompt → 모달)
- **커밋**: `6a556e6`(코드), 본 CYCLES.md
- **마이그레이션**: `20260529060000_space_key` (`Space.key TEXT` + unique index, nullable→다중 null 허용). 수기 + `migrate deploy` + `prisma generate`(API 프로세스 종료 후)
- **변경 (BE)**:
  - `schema.prisma` — `Space.key String? @unique`
  - `dto/create-space.dto.ts` — `key?`(`@MaxLength(20)`, `@Matches(/^[A-Za-z0-9]*$/)`)
  - `spaces.service.create` — 키 trim/대문자 정규화, 빈 값=null, 중복 시 400(`space key already in use`)
- **변경 (FE)**:
  - `CreateSpaceDialog.tsx` 신규 — 공간 이름(필수)/스페이스 키(선택, 이름에서 자동 제안·수정 시 고정)/설명. POST `/api/spaces`, 중복 키 400 안내. `layout.tsx`(TopNav 경로)·`/spaces` 디렉터리 둘 다 이 모달 사용 → 기존 `prompt` 체인 2곳 제거
  - `CreatePageDialog.tsx` 신규 — '만들기' 모달. 카드 그리드(현재 '빈 페이지' 1개, 향후 템플릿). `TopNav.CreateSplitButton` ⋯ 가 드롭다운(새 페이지/새 공간) 대신 이 모달을 열고 '빈 페이지' → `handleQuickCreate`. `onCreateSpace` prop 은 SpaceCombobox 만 사용하도록 정리
  - `lib/types` `SpaceWithPages.key?`
- **검증**: web/api `tsc --noEmit` EXIT 0, jest **154 passed (15 suites)**
- **동작 확인 안내**:
  1) ⚠️ **`cd apps/api && npx prisma migrate deploy`** + `npx prisma generate` (적용 완료, **API dev 서버 재기동 필요**)
  2) 공간 메뉴/‘새 공간’/‘+ 공간 만들기’ → '공간 만들기' 모달(이름·키·설명). 같은 키로 재생성 시 400 안내
  3) 네비 '만들기' 옆 ⋯ → '만들기' 모달의 '빈 페이지' 카드 → draft 생성+편집 진입
- **남은 일**: 페이지 템플릿 카드(추후). **브라우저 시각 확인 미수행**
- **비고**: 스페이스 키는 nullable unique(기존 공간 null 유지). '공간 만들기'의 ‘새 공간’ 항목은 ⋯ 모달에서 제외(공간 생성은 공간 메뉴/디렉터리 경로 유지).

---

## Cycle 81 — 2026-05-29 — ✅ Done (페이지 조회 헤더 — 제한 버튼 + 액션 우측 정렬)
- **제목**: 조회 화면 브레드크럼 줄에 '제한' 버튼 + 액션(편집/저장/지켜보기/공유/더보기) 우측 정렬
- **카테고리**: FE 전용 / UX (PageHeader 레이아웃)
- **커밋**: `0b7746e`(코드), 본 CYCLES.md
- **변경 파일 (FE)**:
  - `PageHeader.tsx` — 브레드크럼과 액션 클러스터를 **한 줄**로 통합: 좌측 브레드크럼(`overflow-hidden`+`truncate`) + `RestrictButton`(제한), `ml-auto` 로 액션 우측 정렬. 제목(h1)+상태 배지는 그 **아래 줄**로 분리. `RestrictButton` 신규(로컬 팝오버) — 트리거 `open-padlock`(제한 없음), 팝오버에 '공간 권한을 따름' 안내 + `lock` 아이콘으로 '특정 사용자/그룹 제한 — 준비 중'
  - `AppIcon.tsx` — `lock`(/icons/lock.png), `openPadlock`(/icons/open-padlock.png) 등록. 에셋 2개 커밋 포함
- **검증**: web `tsc --noEmit` EXIT 0, jest **154 passed (15 suites)**. 마이그레이션 없음
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 페이지 조회: 브레드크럼 줄 좌측에 '제한'(열린 자물쇠), 우측에 편집/나중을 위해 저장/지켜보기/공유/⋯ 한 줄 정렬
  3) '제한' 클릭 → 팝오버(제한 없음 안내 + 닫힌 자물쇠로 준비 중 표기)
- **남은 일**: 실제 페이지 제한(특정 사용자/그룹 접근 제어)은 백엔드 미구현 — 버튼은 현재 상태 표시 + 안내만. **브라우저 시각 확인 미수행**
- **비고**: PageHeader 는 조회 모드 전용(편집은 FullScreenEditor) — `isBodyEditable` 분기는 유지하되 실사용 경로는 조회. 제한 enforcement 는 향후 권한 사이클에서.

---

## Cycle 82 — 2026-06-01 — ✅ Done (편집 화면 브레드크럼 클릭 가능 + 라벨/제한 노출)
- **제목**: FullScreenEditor 의 브레드크럼 조상을 조회와 동일하게 클릭 가능하게 하고, 비활성 placeholder 였던 라벨/제한을 실제 컴포넌트로 교체해 같은 줄에 배치
- **카테고리**: FE 전용 / UX (편집 화면 헤더 통합)
- **커밋**: `8a5913a`(코드), 본 CYCLES.md
- **변경 파일 (FE)**:
  - `RestrictButton.tsx` 신규 — Cycle 81 에서 `PageHeader` 내부 함수였던 RestrictButton 을 별도 컴포넌트로 추출(조회/편집 양쪽 공유). 동작 동일(unlock/lock 아이콘 팝오버 안내)
  - `PageHeader.tsx` — 인라인 `RestrictButton` 함수 삭제 → 공유 컴포넌트 import
  - `FullScreenEditor.tsx` — 브레드크럼 줄을 한 묶음으로 정리: 조상 항목을 `onSelectAncestor` 있을 때 `<button>` 으로 렌더(hover 밑줄), 비활성 '🏷️ 라벨'/'🔒 제한' placeholder 두 개 제거 → 실제 `LabelBar`(editable=true) + `RestrictButton` 을 브레드크럼과 같은 줄(`flex-wrap items-center gap-3`)에. `onSelectAncestor?: (id) => void` prop 추가
  - `page.tsx` — `<FullScreenEditor onSelectAncestor={selectPage} />` 전달. selectPage 는 `router.push('?pageId=…')` 라 URL 변경으로 `isBodyEditable` 이 자연 종료(편집 종료 + 이동 한 흐름)
- **검증**: web `tsc --noEmit` EXIT 0. 마이그레이션 없음
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 편집 화면 상단 브레드크럼: 조상 페이지명 클릭 → 편집 종료 + 그 페이지로 이동
  3) 브레드크럼 옆에 라벨 칩 + '＋ 레이블 추가' 팝업(editable) + '제한' 버튼(팝오버 안내) 노출
- **남은 일**: 없음. **브라우저 시각 확인 미수행**
- **비고**: 편집 도중 조상 클릭은 자동 저장(autosave) 흐름이 처리(URL 변경 = 컴포넌트 unmount → flush). 페이지 제한 enforcement·라벨의 공간 전역 검색은 별 사이클.
- **82 followup (피드백 반영)**: `LabelBar` 의 별도 '＋ 레이블 추가' 버튼 제거 → **🏷️ 아이콘 자체가 추가 팝업 트리거**(editable 일 때 버튼, 아니면 단순 표시). (`285b1d4`)

---

## Cycle 83 — 2026-06-01 — ✅ Done (페이지 단위 제한 — 3 모드 + 사용자별 권한)
- **제목**: '제한 없음'(공간 권한 그대로) / '편집 제한'(보기는 모두, 편집은 일부) / '보기 및 편집 제한'(일부만 보기·편집). 사용자별 VIEW/EDIT 역할.
- **카테고리**: BE + FE / 권한 (페이지 단위 RBAC)
- **커밋**: `0e18bf7`(코드), 본 CYCLES.md
- **마이그레이션**: `20260601000000_page_restriction` (`enum PageRestrictionMode/Role`, `Page.restrictionMode` NOT NULL DEFAULT NONE, `PageRestriction(@@id[pageId,userId], role)`). 수기 + `migrate deploy` + `prisma generate`(API 프로세스 종료 후)
- **변경 (BE)**:
  - `schema.prisma` — 2 enum, `Page.restrictionMode`/`restrictions`, `User.pageRestrictions`, `PageRestriction` 모델
  - `space-permission.service.ts` — `assertCanEditPage` 확장(EDIT/VIEW_EDIT 일 때 PageRestriction role=EDIT 필수, 작성자/공간 관리자/전역 ADMIN 통과). `assertCanViewPageRestriction(page, user, access)`(VIEW_EDIT 일 때만 멤버십 필요). `canManagePageRestriction`/`assertCanManagePageRestriction`(작성자/공간 관리자/전역 ADMIN)
  - `pages.service.findOne` — VIEW_EDIT 모드 페이지 보기 시 `assertCanViewPageRestriction` 호출
  - `pages.service` — `getRestriction`/`updateRestrictionMode`/`addRestrictionMember`/`updateRestrictionMember`/`removeRestrictionMember`
  - `pages.controller` — `GET/PATCH /pages/:id/restriction`, `POST/PATCH/DELETE /pages/:id/restriction/members[/:userId]` (JwtAuthGuard, 가드는 서비스에서)
  - `dto/update-page-restriction.dto.ts` 신규
- **변경 (FE)**:
  - `lib/types` — `PageRestrictionMode/Role/Member/State`
  - `RestrictButton.tsx` 전면 재작성 — 트리거(unlock / `RedLockIcon`(lock.png mask-tint #de350b)) + "제한" 라벨(VIEW_EDIT 일 때 빨강). 팝오버: 3 모드 카드(설명·아이콘·✓), EDIT/VIEW_EDIT 일 때 멤버 섹션(UserSearchCombobox 재활용, 역할 선택, role select, 제거 ×). canManage 없으면 모드 변경/멤버 관리 비활성 + 안내
  - `PageHeader` / `FullScreenEditor` — `<RestrictButton pageId={page.id} />`
- **검증**: web/api `tsc --noEmit` EXIT 0, jest **154 passed (15 suites)**
- **동작 확인 안내**:
  1) ⚠️ **`cd apps/api && npx prisma migrate deploy`** + `npx prisma generate` (적용 완료, **API dev 서버 재기동 필요**)
  2) 페이지 조회/편집의 '제한' 클릭 → 3 모드 + 설명. NONE/EDIT=unlock, VIEW_EDIT=빨간 lock
  3) EDIT 선택 → '+ 사용자 추가' → 검색 → 추가(역할=편집 고정). 추가된 사용자만 PATCH 가능, 나머지는 403
  4) VIEW_EDIT 선택 → 사용자별 보기/조회+편집 역할 선택. 멤버 아닌 사용자는 페이지 조회 시 403
  5) 작성자/공간 관리자/전역 ADMIN 은 모드 무관 통과
- **남은 일**: 본 사이클이 Task I 의 '페이지 단위 접근 제한 (Cycle 81)' 항목을 닫음. 추가 후속: 멤버 일괄 추가/검색 결과 페이지네이션, 제한 변경의 감사 로그 기록. **브라우저 시각 확인 미수행**
- **비고**: 모드별 의미 — NONE=공간 권한 그대로, EDIT 모드는 보기는 공간 권한, 편집만 멤버(role=EDIT) 한정, VIEW_EDIT 모드는 보기·편집 모두 멤버 한정(role=VIEW 는 보기만, EDIT 은 편집까지). 빨간 lock 은 CSS mask-image 로 PNG 를 #de350b 로 재칠.
- **83 followup (피드백 반영)**: 좁은 화면에서 잘리던 absolute 팝오버 → **shadcn `Dialog` 모달**로 전환(중앙 정렬·반응형). 트리거 버튼에서 '제한' 텍스트 제거 — 자물쇠 아이콘만 노출(title/aria-label 로 의미 보존). (`c9ea38c`)
- **83 followup 2 (피드백 반영)**: ① 다이얼로그 폭 28rem·높이 34rem **고정**(`DialogContent` 명시) — 멤버 추가로 크기가 변하지 않음. ② **허용 사용자 페이지네이션**(4명/페이지, 이전/다음, 'N명 · X/Y' 표시). ③ `updateRestrictionMode` 가 모드 실제 변경 시 `PageRestriction` 전체 삭제(트랜잭션) — EDIT→VIEW_EDIT 시 이전 멤버가 그대로 남던 문제 해소(역할 의미가 달라지므로 깨끗하게 시작). (`4dcdd26`)
- **83 followup 3 (피드백 반영)**: 다이얼로그 안 변경이 즉시 저장되던 동작을 **명시적 '적용'/'취소'** 로 변경. 모드 카드 클릭·멤버 추가/역할/제거 모두 로컬 draft 만 갱신. '적용' 시 단일 `PATCH /pages/:id/restriction { mode, members }` 로 원자적 교체(서비스: mode 갱신 + 멤버 전체 deleteMany + createMany 트랜잭션, EDIT 모드 role=EDIT 강제, NONE 은 빈 멤버, 중복/미존재 검증). '취소'/닫기는 draft 폐기 → 다음 열 때 서버 상태로 재초기화. DTO `members` 옵셔널 필드 추가, `UserSearchCombobox.onSelect` 가 department 도 전달(draft 표시용). (`0c9b42d`)
- **83 followup 4 (피드백 반영)**: '취소' 버튼이 적용 중 비활성화되던 것을 **항상 활성**으로 — 진행 중이어도 닫기 가능(in-flight mutation 은 그대로 완료, 이미 닫힌 상태라 무해). (`189fd19`)

---

## Cycle 84 — 2026-06-01 — ✅ Done (코드 블록 언어 선택 인라인 + '본문으로' 빠져나가기)
- **제목**: 편집 화면 코드 블록의 언어 선택을 툴바에서 블록 자체로 이동하고, 코드 블록에서 일반 본문으로 빠져나가는 가시적 버튼 제공
- **카테고리**: FE 전용 / UX (에디터)
- **커밋**: `0e7f2c1`(코드), 본 CYCLES.md
- **변경 파일 (FE)**:
  - `CodeBlockNodeView.tsx` — 우상단의 언어 라벨 `<span>` 을 `<select>` 로 교체(항상 노출, 변경 시 `updateAttributes({ language })`). 호버 영역에 **'↓ 본문'** 버튼 추가 — `getPos() + nodeSize` 위치에 빈 `paragraph` 삽입 후 `setTextSelection` 으로 커서 이동(키보드 Mod-Enter / 트리플 Enter 보완하는 가시적 출구). `CODE_BLOCK_LANGUAGES` 에 없는 언어 attrs 도 옵션에 포함하여 표시 보장
  - `EditorToolbar.tsx` — `editor.isActive("codeBlock")` 컨텍스트 분기의 `CodeBlockLanguageSelect` 사용/정의 제거(블록 NodeView 로 일원화). 미사용 `CODE_BLOCK_LANGUAGES` import 정리
- **검증**: web `tsc --noEmit` EXIT 0. 마이그레이션 없음
- **동작 확인 안내**:
  1) **마이그레이션 불필요**
  2) 코드 블록 우상단에 항상 언어 select 보임 — 다른 언어 선택 시 syntax 하이라이트 갱신
  3) 코드 블록 호버 시 '복사' 옆 **'↓ 본문'** 버튼 → 클릭 시 블록 뒤 본문으로 커서 이동
  4) 툴바에는 더 이상 코드 블록 언어 select 가 뜨지 않음
- **남은 일**: 없음. **브라우저 시각 확인 미수행**
- **비고**: 기존 키보드 단축키(Mod-Enter / 트리플 Enter / 끝에서 ArrowDown)도 그대로 동작 — 버튼은 발견성 보완용. NodeView 의 `contentEditable={false}` 가 컨트롤 영역의 입력 가로채기 차단.
- **84 followup (피드백 반영)**: 가시적 '↓ 본문' 버튼 대신 **코드 블록 끝에서 ArrowRight** 로 탈출하도록 변경. `CodeBlockExtension.addKeyboardShortcuts` 에서 `parentOffset === content.size` 일 때 코드 블록 뒤로 커서 이동(문서 끝이면 빈 paragraph 삽입 후 진입). 가시 버튼은 제거 — 키보드만으로 충분. (`afadb79`)
- **84 followup 2 (피드백 반영)**: PageHeader 의 **'저장됨' 표시 제거**(SaveStatusBadge 의 saved 케이스를 빈 텍스트로) — 자동저장 성공은 조용히 처리. 대신 **`hasDraft` 일 때 제목 옆에 황색 '발행되지 않은 변경 내용' 태그** 노출(미발행 draft 의 가시적 안내). 'saving...'/'저장 실패' 는 그대로 유지. (`c3ec5c7`)
- **84 followup 3 (피드백 반영)**: 발행 직후에도 태그가 잔존하던 버그 → `saveStatus="saved"` → `setHasDraft(true)` 동기화를 **편집 모드(`isBodyEditable`)에서만** 처리. 발행 onSuccess 가 `setIsBodyEditable(false)` + key 변경으로 에디터를 view 모드로 리마운트하는데, 초기 sync 가 "saved" 를 발화해 hasDraft 가 다시 켜지던 race 해소. (`510adbb`)
- **84 followup 4 (피드백 반영, followup 3 의 진짜 원인)**: 발행 직후 에디터 unmount 시 `CollaborativeEditor` 의 autosave cleanup 이 pending timer 의 `flush()` 를 실행해 **방금 발행한 내용과 동일한 draft 를 다시 `PATCH /pages/:id/draft`** — 후속 reload 시 `draftContent != null` 이 되어 태그가 부활. 가드를 `draftContent != null && draftContent !== content` 로 강화해 phantom-draft(내용 동일) 케이스를 false 로 흡수. 새 편집이 들어와 draft 가 published 와 달라지면 정상적으로 true 로 켜짐. (`3362093`)
- **84 followup 5 (피드백 반영)**: 첫 본문 입력 후 '발행/업데이트' 버튼이 5초 뒤에야 활성화되던 문제(자동저장 debounce 에 묶여 있어서) → `CollaborativeEditor` 에 `onContentChange` 콜백 추가. 초기 Yjs/persistence/provider sync 가 끝난 뒤(`syncedRef.current=true`)의 첫 editor `update` 가 일어나면 즉시 호출 → `page.tsx` 가 `setHasDraft(true)` 로 버튼 즉시 활성. 5초 autosave 는 그대로(서버 draft 영속). (`83d8a14`)
- **84 followup 6 (피드백 반영)**: ① `AppIcon` 에 `settings` 등록(`/icons/settings.png`) + Sidebar 의 ⚙️ → AppIcon. ② `SpaceAuditPanel` '더 보기' append 모델을 **이전/다음 페이지네이션**(20건/페이지)으로 교체 — 'X–Y건 (페이지 P/T)' 표시, 필터 변경 시 첫 페이지 리셋. (`c7e0853`)
- **84 followup 7 (피드백 반영)**: 감사 로그 페이지네이션에 **페이지 번호 버튼** 표시(현재 페이지 강조). 7개 초과면 `1 … 4 5 [6] 7 8 … N` 형식으로 축약(`pagesToShow` 계산). 화살표는 ‹/›. (`80b0cfc`)
- **84 followup 8 (피드백 반영)**: 네비/사이드바 이모지 아이콘을 PNG 자산으로 교체 — TopNav 검색 🔍→search.png, 관리자 ⚙️→settings.png, NotificationBellButton 🔔→notification.png, Sidebar 트리 펼침/접힘 '›'/'⌄' → chevron.png(접힘)/down-arrow.png(펼침). AppIcon 에 `search`/`notification`/`chevron` 등록(에셋 3개 커밋). (`edd92f7`)
- **84 followup 9 (피드백 반영)**: 스페이스 사이드바 **접힘 모드**(compact, 56px) 신설. 기존엔 24px '»' 버튼 한 줄만 있었음 → 홈/페이지/보드/캘린더/공간 바로가기(`external-link`)/페이지 트리(`node`)/휴지통/공간 도구 8개 아이콘 세로 노출. 섹션 아이콘(바로가기/트리/공간 도구)은 `onExpand` 콜백으로 사이드바 펴기. `layout` 의 토글 버튼은 «/» 통합. `compact` prop 이름은 기존 트리-행 `collapsed: Set` 과 충돌 회피로 선택. 에셋 `external-link.png`/`node.png` 커밋. (`abd6898`)
- **84 followup 10 (피드백 반영)**: 접힌 상태에서 **공간 바로가기/페이지 트리 아이콘 클릭 시 사이드바 펴기 대신 옆 floating 패널**을 띄움. `compactPopover` state(shortcuts|tree|null) + 외부클릭/Esc 닫힘. 패널은 `absolute left-14` 로 아이콘 컬럼 우측에 노출. shortcuts 패널: 내부 페이지/외부 URL 클릭 → 이동 + 닫힘. tree 패널: 평탄 리스트 + 펼침/접힘 + 클릭 이동(DnD 는 좁은 패널에 부적합해 제외). 공간 도구 아이콘은 여전히 사이드바 펴기 유지. (`33f25b4`)
