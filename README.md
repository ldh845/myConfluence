# DocSpace

사내 위키 시스템 — Confluence 대체 POC.
라이선스 비용 절감 목적, 오픈소스 스택 기반.

## 주요 기능

- **페이지 계층 트리** — 이동/복사/휴지통/즐겨찾기/드래그앤드롭 (FR-021~025)
- **WYSIWYG 에디터** — Confluence 스타일 전체 화면, 마크다운 자동 변환,
  슬래시 명령어, 표 셀 병합, KaTeX 수식, 다이어그램(Excalidraw)
- **실시간 협업** — Yjs CRDT + Hocuspocus, 동시 편집, 커서 공유,
  오프라인 편집 + 재연결 자동 동기화
- **버전 관리** — 발행 시 자동 스냅샷, diff 비교, 원복, 50개 보관
- **댓글** — 페이지/인라인, 답글 스레드, 해결 처리, 이모지 반응
- **첨부파일** — 드래그앤드롭 업로드, 100MB 제한
- **검색** — pg_trgm 한국어 전문 검색, Ctrl+K 빠른 검색,
  스페이스/날짜/작성자 필터
- **인증** — Keycloak OIDC SSO + 단일 로그아웃(SLO), **로컬 로그인 병행
  (하이브리드, `LOCAL_LOGIN_ENABLED`)**. 세션은 자체 `docspace_session` JWT
  httpOnly 쿠키(7일 만료). 계정 활성/비활성, 비밀번호 정책·로그인 실패 잠금,
  역할(ADMIN/DEVELOPER) 관리
- **권한** — 3계층(전역 역할 / 스페이스 멤버십·공개범위 / 페이지 단위 제한)에
  **그룹 기반 권한(개인∪그룹 max, deny 없음)** + **부서 자동 권한**(로그인 시
  그룹 자동배정 — Keycloak 그룹 동기화 + `department` 폴백) 결합. 접근 권한
  역산 조회 API(공간/페이지를 누가 볼 수 있나)
- **프로그램 연동** — **API 토큰**(발급·스코프 READ/READ_WRITE·폐기,
  `Authorization: Bearer dsp_…`) + **OpenAPI 명세**(`/api/docs`,
  `ENABLE_API_DOCS`) → 사내 MCP 연동. 자세히는
  [`docs/MCP-INTEGRATION.md`](docs/MCP-INTEGRATION.md)
- **공유** — 토큰 기반 read-only 외부 링크
- **내보내기** — Markdown / PDF
- **홈 대시보드** — 발견 / 내 작업 / 내 공간 (Confluence 스타일)
- **활동 피드** — 페이지/댓글 8종 이벤트 타임라인
- **공간 디렉토리** — 모든 공간 / 내 공간 등 탭 구조

## 기술 스택

- **Frontend**: Next.js 14 (App Router, TypeScript), Tailwind CSS,
  TipTap 2 + Yjs, Zustand, TanStack Query
- **Backend**: NestJS, Prisma 6, PostgreSQL 16 (pg_trgm GIN 인덱스)
- **협업**: Hocuspocus (NestJS 호스팅, Redis adapter 옵션 —
  `USE_REDIS` 환경변수로 토글)
- **인프라**: Docker Compose 풀스택 (개발·운영 공통). VM 단일 인스턴스
  운영 중, AFS/K8s 입주 준비 중.

## 프로젝트 구조 (npm workspaces 모노레포)

```
apps/
  web/    # Next.js 14 사용자 화면 (에디터, /home, /spaces, /activity 등)
  api/    # NestJS + Prisma (REST API + Hocuspocus 협업 서버)
deploy/   # 재배포 스크립트(redeploy.sh) + nginx config + override.example
docs/     # 운영 문서 (DEPLOY.md 등)
```

## 시작하기 — 개발 환경 (Docker)

### 1. 환경변수 준비

- 루트 `.env` ← `.env.example` 복사: `POSTGRES_PASSWORD`(Cycle 46 부터
  필수, `openssl rand -hex 32` 권장), 필요 시 `NEXT_PUBLIC_WS_URL`
- `apps/api/.env` ← `.env.example` 복사: `DATABASE_URL`
  (`${POSTGRES_PASSWORD}` 참조), `JWT_SECRET`, Keycloak OIDC 값
  (`KC_ISSUER_URI`, `KC_CLIENT_ID`, `KC_CLIENT_SECRET`,
  `OIDC_REDIRECT_URI`, `OIDC_POST_LOGIN_REDIRECT`, `OIDC_POST_LOGOUT_REDIRECT`)
  - 선택 플래그(둘 다 기본 비활성): `LOCAL_LOGIN_ENABLED`(로컬 ID/PW 로그인
    on/off — 운영 정책 미정), `ENABLE_API_DOCS`(OpenAPI 명세 `/api/docs` 노출
    — 사내망이면 켜둬도 무방, 외부 노출 환경이면 끄기). 운영 의미는
    [`docs/DEPLOY.md`](docs/DEPLOY.md) 참조

### 2. 컨테이너 풀스택 기동 (권장)

```bash
docker compose up -d   # postgres + api + web + keycloak + redis + nginx
```

- Keycloak 이 함께 기동(realm `docspace` 자동 import) — SSO 테스트에 필요
- api 컨테이너가 기동 시 자동으로 `prisma migrate deploy`
- 브라우저 <http://localhost:3000> (web 컨테이너 직접 진입). `/api` 호출은
  web 이미지에 `API_HOST=api` 가 박혀 있어 api 컨테이너로 자동 프록시
- 베이스 compose 의 nginx `:80` 은 호스트 dev 모드(아래 3) 용 dev 도우미라
  컨테이너 풀스택 모드에선 미사용
- 운영과 동일한 단일 진입(`:8082` + 경로 분기 + Keycloak `/auth` 마운트)을
  재현하려면 `deploy/docker-compose.override.example.yml` 을 루트에
  `docker-compose.override.yml` 로 복사 — 자세한 절차는
  [`docs/DEPLOY.md` 3.7](docs/DEPLOY.md) 참조

### 3. (선택) 호스트에서 직접 개발 (핫리로드)

```bash
npm install
cd apps/api && npx prisma migrate deploy
npm run dev:all        # web + api + hocuspocus 동시 기동
```

- 브라우저 <http://localhost:3000>
- postgres·keycloak 는 compose 로 띄워두고 api/web 만 호스트에서

자세한 운영·배포 절차는 [`docs/DEPLOY.md`](docs/DEPLOY.md) 참조.

## 운영·접속

> DocSpace 는 **사내망 전용**(외부 인터넷 노출 없음)을 전제로 운영한다.

- **운영 환경**: VM 단일 인스턴스 — <http://166.79.31.248:8082>
- **개발**: 로컬 <http://localhost:3000>(호스트 dev) 또는
  <http://localhost:8082>(컨테이너 풀스택 + override 적용 시)
- 배포·접속 자세한 절차는 [`docs/DEPLOY.md`](docs/DEPLOY.md) 참조

## UI 레이아웃 (Confluence 스타일)

- **상단 TopNav**: 공간 드롭다운 / 달력 / 만들기 / 검색 / 사용자 메뉴
- **좌측 사이드바**:
  - 시스템 홈(`/home`) — "발견 / 내 작업 / 내 공간" 시스템 사이드바
  - 스페이스 진입 후 — 페이지 트리 사이드바
- **본문**: 조회 모드 + 전체 화면 편집기
  (편집 시 사이드바 가려짐, TopNav만 유지)
- **검색**: Ctrl+K 또는 상단 검색바 → 풀스크린 오버레이
  (필터링 기준 + 페이지/스페이스 결과)

## 알려진 한계

- 색상 / 하이라이트 / 언더라인 / 인라인 댓글 마크는 새로고침 시 시각적으로
  소실 (Markdown 표준 한계, DB엔 보존). 저장 포맷 전환 사이클로 해결 예정.
- 다이어그램은 동시 편집 미지원 (last-write-wins).
- AI 챗 패널은 SRS 에 명세 없음. 도입 시 스펙 정의 선행 필요.
- 멘션·인앱 알림 미구현 (FR-072, FR-100). Task G(미구현 기능)의
  우선순위 항목.

## 관련 문서

- [`CLAUDE.md`](CLAUDE.md) — 프로젝트 메모리 (AI 협업·기술 컨텍스트·함정)

- [`docs/CYCLES.md`](docs/CYCLES.md) — 개발 로그 (사이클별 상세 — 커밋·
  변경 파일·검증·함정)

- [`docs/TASKS.md`](docs/TASKS.md) — Task 현황 (주제 중심 7 Epic — 주간
  보고·Jira 입력 base)

- [`docs/DEPLOY.md`](docs/DEPLOY.md) — 운영·배포 매뉴얼 (VM 셋업·재배포·
  트러블슈팅·함정)
- [`docs/MCP-INTEGRATION.md`](docs/MCP-INTEGRATION.md) — 사내 MCP/외부 연동
  가이드 (API 토큰·스코프·권한·핵심 엔드포인트·OpenAPI 위치)
- [`deploy/redeploy.sh`](deploy/redeploy.sh) — VM 재배포 스크립트
- `docs/CYCLES-ldh.md` / `docs/TASKS-ldh.md` — `feature/ldh` 작업 로그·Task
  현황 (인증·권한·API 토큰 보강 — L-AUTH/L-AUTHZ/L-API)
