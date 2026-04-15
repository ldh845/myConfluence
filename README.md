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

### 사내망에서 다른 PC로 접속하기

한 대의 PC(이하 "서버 PC")에서 Next.js + y-websocket을 띄워두고,
같은 네트워크의 팀원이 브라우저로 붙어 공동 편집하는 구성입니다.

1. **서버 PC에서 실행**
   ```bash
   npm run dev:all
   ```
   `next dev`는 `-H 0.0.0.0 -p 3000`으로, `ws-server`는 `0.0.0.0:1234`로
   모든 인터페이스에서 리스닝합니다.

2. **Windows 방화벽에서 포트 허용**
   "Windows Defender 방화벽 → 고급 설정 → 인바운드 규칙 → 새 규칙"에서
   TCP 포트 **3000** (Next.js) 와 **1234** (y-websocket) 를 각각 허용합니다.
   사내망 프로파일(도메인/개인)에만 적용하면 충분합니다.

3. **서버 PC의 IP 확인**
   ```cmd
   ipconfig
   ```
   사내망에 연결된 어댑터의 `IPv4 주소` (예: `10.0.0.5`) 를 확인합니다.

4. **팀원 접속**
   팀원은 브라우저에서 `http://서버PC_IP:3000` (예: `http://10.0.0.5:3000`)
   로 접속합니다. WebSocket 주소는 브라우저가 접속한 호스트명에서 자동으로
   유도되므로 (`ws://서버PC_IP:1234`) 별도 설정이 필요 없습니다.

   고정 도메인이나 다른 포트를 쓰고 싶다면 `.env`에
   `NEXT_PUBLIC_WS_URL="ws://my-host:1234"` 를 설정하면 우선 적용됩니다.

## UI 레이아웃

Confluence와 유사한 3분할 구조:

- **좌** : Space / Page 계층형 트리
- **중** : 마크다운 뷰어 + 에디터 (Edit / View 전환)
- **우** : AI 챗 패널 — 질문하면 저장된 모든 페이지를 참조해 Claude가 답변,
  근거 페이지를 클릭하면 해당 페이지로 이동

## 다이어그램 (Excalidraw)

페이지 본문 아래 **📐 다이어그램** 영역에서 Excalidraw로 다이어그램을
추가/편집/삭제할 수 있습니다.

- **외부 호출 없음** — `@excalidraw/excalidraw`는 순수 React 컴포넌트로,
  번들이 로컬에서 실행되며 사내망에서도 별도 프록시/화이트리스트 없이
  그대로 동작합니다.
- 다이어그램 데이터는 Excalidraw 고유 JSON(`{elements, appState, files}`)
  포맷으로 DB의 `Diagram.data` 컬럼에 저장됩니다. 저장 시점에 SVG 미리보기가
  함께 생성되어 `Diagram.preview` 컬럼(데이터 URI)에 저장되며, 카드 리스트의
  썸네일로 사용됩니다.
- 이 POC에서는 다이어그램의 공동 편집을 **지원하지 않습니다.** 두 명이 동시에
  같은 다이어그램을 편집하면 나중에 저장한 사람의 변경이 이깁니다
  (last-write-wins). 향후 개선 예정입니다.

## 범위 외 (추후 확장)

- 인증 / 권한 관리
- 댓글, 버전 관리, 첨부파일
- 전문 검색(Embedding 기반) — 현재는 모든 페이지를 Claude context에 주입
