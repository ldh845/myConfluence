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
- **인증** — 회원가입/로그인, JWT httpOnly 쿠키
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
- **인프라**: Docker Compose (개발) / 사내 PC 직접 설치(운영) 둘 다 지원

## 프로젝트 구조 (npm workspaces 모노레포)

```
apps/
  web/    # Next.js 14 사용자 화면 (에디터, /home, /spaces, /activity 등)
  api/    # NestJS + Prisma (REST API + Hocuspocus 협업 서버)
docs/     # 운영 문서 (DEPLOY.md 등)
```

## 시작하기 — 개발 환경 (Docker)

1. PostgreSQL + Redis 기동
   ```bash
   docker compose up -d
   ```
2. 의존성 설치 (workspaces가 `apps/web` + `apps/api` 자동 처리)
   ```bash
   npm install
   ```
3. `apps/api/.env` 작성 (`.env.example` 복사 후 `DATABASE_URL` / `JWT_SECRET` 채움)
4. DB 스키마 적용
   ```bash
   cd apps/api && npx prisma migrate deploy && npx prisma generate
   ```
5. 개발 서버 동시 기동 (web + api + hocuspocus)
   ```bash
   npm run dev:all
   ```
6. 브라우저 <http://localhost:3000>

## 시작하기 — 사내 PC 운영 (Docker 없이)

- PostgreSQL 16 네이티브 설치, `docspace` DB + `pg_trgm` 확장 활성
- `.env`에 `USE_REDIS=false` 설정 → Hocuspocus 단일 인스턴스(메모리) 모드
- 자세한 절차는 [docs/DEPLOY.md](docs/DEPLOY.md) 참조

## 사내망 다른 PC에서 접속

- 서버 PC에서 `npm run dev:all` (Next.js 3000, Hocuspocus 1234 모두
  `0.0.0.0`로 listen)
- Windows 방화벽에서 TCP 3000, 1234 인바운드 허용
- 팀원: `http://<서버PC_IP>:3000` 접속 (WebSocket 주소는 자동 유도)

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
- AI 챗 패널은 SRS 5.9 검색·AI 사이클 대기 중 (현재 비활성).
- 멘션(`@user`)은 인증 의존 — 후속 사이클.
