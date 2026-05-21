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
