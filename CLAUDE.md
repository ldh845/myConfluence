# DocSpace — Claude Code 프로젝트 메모리

> 새 세션이 흡수하는 항시 컨텍스트. 사실 위주, 간결. 자세한 건 `docs/*`, `SRS.md` 참조.

## 한 줄 소개

DocSpace — Confluence 대체 사내 위키 POC. 라이선스 비용 절감 + 오픈소스 스택 기반.
GitHub 식별자는 `myConfluence` (저장소 이름), 프로젝트명은 `DocSpace`.

## 기술 스택

- **Frontend**: Next.js 14 (App Router, TypeScript) / Tailwind / shadcn/ui / TipTap 2 + Yjs / Zustand / TanStack Query
- **Backend**: NestJS / Prisma 6 / PostgreSQL 16 (pg_trgm GIN 인덱스) / Keycloak OIDC SSO + 자체 `docspace_session` JWT httpOnly 쿠키
- **협업**: Hocuspocus (NestJS가 호스팅, 같은 프로세스 안 :1234) — Redis adapter는 `USE_REDIS` 토글 옵션
- **인프라**: Docker Compose(개발) 또는 사내 PC 직접 설치(운영). 둘 다 지원.

## 폴더 구조 (npm workspaces 모노레포)

```
apps/
  web/    Next.js 14. 사용자 화면 — (app)/ route group이 TopNav + Sidebar 영속 셸.
  api/    NestJS. REST API + Hocuspocus 협업 서버를 같은 프로세스에서 호스팅.
docs/     운영/이력 문서 — DEPLOY.md, CYCLES.md(개발 로그), TASKS.md(사람용 Task 현황)
.claude/skills/   팀 공유 스킬 (그 외 .claude/* 는 gitignore)
```

## 새 세션이 먼저 읽어야 할 파일 (우선순위 순)

1. **`SRS.md`** — 무엇을 만들고 있는가. FR-XXX 번호의 출처. (단, `.gitignore` 됨 — 로컬 환경에만 존재. 없으면 README 로 폴백)
2. **`docs/CYCLES.md`** 의 *마지막* 사이클 — 직전 작업이 무엇을 끝냈고 무엇이 남았는지.
3. 마지막 사이클 항목의 **"남은 일"** 필드 — 진행 중 작업이 있으면 거기서 이어받기.
4. (이슈성 작업이면) `docs/DEPLOY.md` 트러블슈팅 표 — 같은 증상 기록 있는지.

## 사이클 컨벤션

- 사이클 번호는 정수(`Cycle 40`)가 기본. 하나의 큰 작업이 서브로 쪼개지면 `Cycle 16-3b-1` 같은 sub-suffix.
- 같은 사이클 안에서 후속 수정은 별도 커밋 + 메시지 `Cycle N followup: ...` 또는 `Cycle N fix: ...`.
- 사이클이 아닌 일반 문서/수정은 `Docs: ...` / `Fix: ...` 접두.
- 핵심 변경 commit 직후 **`docs/CYCLES.md`** 맨 아래에 새 섹션 append + 별도 commit (`Docs: log Cycle N to CYCLES.md`).
- 섹션 필수 필드: 제목 / 카테고리 / 커밋 / 변경 파일 / 검증 / 남은 일 / 비고.
- 상태 이모지: ✅ Done / 🔄 In Progress / ⛔ Blocked / ⏭ Skipped / 📝 Planned.

자세한 절차는 `.claude/skills/docspace-cycle-rules.md` 가 관리.

## 포트 컨벤션 — 절대 깨면 안 됨 (Cycle 40)

- **`apps/api/.env` 의 `PORT`** = **`apps/web/.env` 의 `API_PORT`** — 반드시 같은 값.
- 둘 다 기본값 **3001** (코드 fallback과 일치). 특별한 이유 없으면 그대로.
- 불일치 시 회원가입/로그인에서 503 또는 `ECONNREFUSED ::1:<port>` 발생.
- Cycle 40에서 영구 fix 완료 — 두 `.env.example` 모두 3001 명시, `next.config.mjs` 가 `process.env.API_PORT || '3001'` 사용. 회귀 주의.

기타 포트: Next.js 3000 (사용자), Hocuspocus 1234 (브라우저가 직접 접속).

## 자주 쓰는 명령

```bash
docker compose up -d                          # Postgres + Redis (개발 환경)
npm install                                   # workspaces가 web + api 동시 설치
cd apps/api && npx prisma migrate deploy      # 마이그레이션 적용
cd apps/api && npx prisma generate            # Prisma client 재생성
npm run dev:all                               # web + api 동시 기동
cd apps/api && npm run build                  # NestJS 컴파일 → dist/
```

사내 PC(Docker 없음) 셋업은 `docs/DEPLOY.md` "1. 단일 인스턴스 배포" 참조.

## 알려진 함정

- **EOL CRLF/LF**: Windows에서 작업하면 `git diff` 에 가짜 변경 대거. 정공법은 `.gitattributes` 에 `* text=auto eol=lf` 박아 통일. (autocrlf 옵션은 분쟁 원인이므로 권장 안 함)
- **Prisma engine 잠금** (Windows): 멈춘 `node` 프로세스가 `query_engine-windows.dll.node` 를 잡고 있어 `prisma generate` 가 EPERM. 죽은 nest watch 프로세스 정리 후 재시도.
- **~~마크다운 직렬화 한계~~** (Cycle 57 해결): 자동저장/발행을 ProseMirror JSON 으로 전환. content 가 `{` 로 시작하면 JSON, 아니면 옛 markdown (자동 감지). 모든 노드/마크(멘션·이미지 캡션·인라인 댓글·색상·하이라이트 등) 100% 라운드트립. 옛 페이지는 다음 자동저장 시 자연 마이그레이션. MoreMenu '내보내기' 는 그대로 동작.
- **draft 페이지 모델** (Cycle 35): `publishedAt=null` 페이지는 모든 read 엔드포인트(`findAll`, `recent`, `search`, `full-search`, `spaces.pages`)에서 숨김. 사이드바 트리에도 안 보임. 첫 발행 시점에 `publishedAt` 채워짐 → 그제서야 노출.
- **다이어그램 동시 편집 미지원** (Excalidraw, last-write-wins).
- **사이드바의 "홈" = `Space.homePageId`** (Cycle 33). 공간 생성 시 "Main Page" 자동 생성 + 지정. 트리에선 홈이 제외되고 홈의 직계 자식이 루트로 승격.

## 스킬과의 관계

- **`.claude/skills/docspace-cycle-rules.md`** 가 사이클 *절차* 담당 — 자동 push 금지 + CYCLES.md 자동 갱신.
- 이 `CLAUDE.md` 는 그 스킬이 전제하는 *컨텍스트* 만 제공. 절차 중복 금지.
- 즉 "Cycle N 진행" 요청을 받으면 → 스킬이 절차를, CLAUDE.md가 배경(포트/함정/구조)을 공급.

## 사용자 정보 보충

- 로그인은 Keycloak OIDC SSO 단일 경로 (Cycle 43). 자체 회원가입 페이지·
  `/auth/signup`·`/auth/login`·bcrypt 모두 제거됨.
- 첫 OIDC 로그인 사용자가 자동 `ADMIN`. 이후 사용자는 일반 권한.
- 계정 매핑: Keycloak `sub` → `User.keycloakId`. 없으면 `preferred_username`
  로 기존 계정 링크, 그래도 없으면 신규 생성 (SSO 전용 → `passwordHash=null`).
- 세션은 자체 `docspace_session` JWT httpOnly 쿠키 7일 만료. 미인증으로 보호
  라우트 진입 시 미들웨어가 `/login`(SSO 로그인 버튼)으로 redirect.
- 로그아웃은 단일 로그아웃(SLO) — 같은 Keycloak 쓰는 서비스 전체에서 로그아웃.

## 진행 상황 스냅샷

- **최신 사이클 / 직전 작업 / 남은 일** → `docs/CYCLES.md` 의 마지막 항목 참조.
  이 파일은 그 값을 복사하지 않는다 (복사본이 staleness 의 원인).
- 아키텍처 현황 (사이클이 그 사실을 바꿀 때만 갱신):
  - 인증: Keycloak OIDC SSO (Cycle 43). 세션은 자체 `docspace_session` JWT
    httpOnly 쿠키 유지.
  - 배포: Docker 이미지 컨테이너화 + VM 실빌드 검증 완료 (Cycle 42 / 42
    followup). AFS(K8s) 입주 대기.
- 미구현: AI 챗 패널(SRS 미명세 — 도입 시 스펙 정의 필요), 멘션 `@user`, 다이어그램 동시 편집.
- 운영 시나리오: 사내 PC 단일 인스턴스 = `USE_REDIS=false` + Postgres
  네이티브. 자세히는 `docs/DEPLOY.md`.
