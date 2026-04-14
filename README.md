# myConfluence (POC)

사내 Confluence를 대체하기 위한 위키 시스템 POC입니다.
라이선스 비용 절감이 목적이며, 핵심 3가지 기능(페이지 CRUD / 계층형 트리 /
AI 기반 검색·Q&A)의 feasibility를 검증합니다.

## 기술 스택

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- Prisma ORM + SQLite
- **TipTap v2** (WYSIWYG 에디터) + **Yjs** CRDT + **y-websocket** 동기화 서버
- `tiptap-markdown` (DB 저장 포맷은 Markdown 유지)
- Anthropic Claude API (`claude-sonnet-4-6`)

## 프로젝트 구조

```
app/               # Next.js App Router 페이지/레이아웃
app/api/           # API 라우트 (pages, spaces, ai/search)
components/        # Sidebar, Editor, ChatPanel
lib/               # Prisma 클라이언트, Claude SDK 클라이언트, 공용 타입
prisma/            # schema.prisma, seed.ts
```

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사해 `.env` 파일을 만들고 값을 채웁니다.

```bash
cp .env.example .env
```

```
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-sonnet-4-6"
```

### 3. DB 초기화

```bash
npx prisma migrate dev --name init
```

### 4. (선택) 시드 데이터 생성

```bash
npm run seed
```

### 5. 개발 서버 실행

실시간 공동 편집을 위해 **Next.js 서버 + y-websocket 동기화 서버** 두 개가
필요합니다.

**옵션 A — 한 번에 실행 (권장)**

```bash
npm run dev:all
```

내부적으로 `concurrently`가 `npm run dev`(Next.js)와 `npm run ws-server`
(y-websocket)을 동시에 띄웁니다.

**옵션 B — 터미널 두 개로 각각 실행**

```bash
# 터미널 A
npm run ws-server    # ws://localhost:1234

# 터미널 B
npm run dev          # http://localhost:3000
```

접속: [http://localhost:3000](http://localhost:3000)

### 실시간 공동 편집 시연

1. Chrome 창 2개(또는 시크릿 모드 포함)에서 동일 URL을 연다.
2. 동일 페이지를 선택한 뒤 한쪽에서 타이핑하면 반대쪽에 즉시 반영되고
   서로의 커서 위치/이름 라벨이 표시된다.
3. 편집을 멈추면 2초 뒤 하단 우측 상태가 "저장 중..." → "저장됨"으로 바뀌며
   `PATCH /api/pages/:id`로 Markdown이 DB에 영속된다.
4. 사용자 이름/색상은 첫 접속 시 자동 생성되어 `localStorage`에 저장되며,
   재접속 시 동일한 이름으로 복원된다.

## UI 레이아웃

Confluence와 유사한 3분할 구조:

- **좌** : Space / Page 계층형 트리
- **중** : 마크다운 뷰어 + 에디터 (Edit / View 전환)
- **우** : AI 챗 패널 — 질문하면 저장된 모든 페이지를 참조해 Claude가 답변,
  근거 페이지를 클릭하면 해당 페이지로 이동

## 범위 외 (추후 확장)

- 인증 / 권한 관리
- 댓글, 버전 관리, 첨부파일
- 전문 검색(Embedding 기반) — 현재는 모든 페이지를 Claude context에 주입
