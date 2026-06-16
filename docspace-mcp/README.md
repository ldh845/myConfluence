# DocSpace MCP Server

사내 AI가 DocSpace 위키 문서를 검색·조회할 수 있게 해주는 MCP 서버입니다.
Node.js 내장 모듈만 사용 — 외부 의존성 없이 `node server.js` 로 바로 실행됩니다.

## ① 설치

```powershell
# 의존성 없음 — Node.js 18+ 만 필요
cd docspace-mcp
```

## ② 실행

### PowerShell (Windows)

```powershell
$env:DOCSPACE_TOKEN="dsp_xxxxxxxx"
$env:PORT="8765"
node server.js
```

### Bash (Linux/macOS)

```bash
DOCSPACE_TOKEN=dsp_xxxxxxxx PORT=8765 node server.js
```

### 토큰 발급 (최초 1회)

```powershell
# DocSpace 로그인 후 API 토큰 발급 (READ 스코프면 충분)
Invoke-RestMethod -Uri "http://166.79.31.248:8082/api/auth/tokens" `
  -Method POST `
  -Headers @{ "Content-Type"="application/json" } `
  -WebSession $session `   # 브라우저 로그인 세션
  -Body '{"name":"mcp-server","scope":"read"}'
```

### 환경변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `DOCSPACE_TOKEN` | ✅ | — | Bearer 인증 토큰 (`dsp_...`) |
| `DOCSPACE_BASE` | — | `http://166.79.31.248:8082/api` | DocSpace API 베이스 URL |
| `PORT` | — | `8765` | MCP 서버 리슨 포트 |

## ③ 사내 AI MCP 등록

서버 실행 후, 사내 AI의 MCP 서버 설정에 다음 값을 등록하세요:

```
host: <이 PC의 IP 주소>   (예: 192.168.1.100)
port: 8765
path: /mcp
```

### 등록 예시 (MCP 클라이언트 설정)

```json
{
  "mcpServers": {
    "docspace": {
      "transport": "streamable-http",
      "url": "http://192.168.1.100:8765/mcp"
    }
  }
}
```

## 제공 도구

### `docspace_search`

DocSpace 위키에서 문서를 검색합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `query` | string | ✅ | 검색어 |
| `spaceId` | string | — | 스페이스 ID (지정 시 full-search 사용) |
| `limit` | string | — | 결과 수 제한 (기본 20) |

### `docspace_read_page`

DocSpace 위키에서 특정 페이지를 조회합니다.
ProseMirror JSON 본문을 평문 텍스트로 변환해 반환합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `pageId` | string | ✅ | 조회할 페이지 ID |

## API 엔드포인트

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/mcp` | POST | MCP JSON-RPC 요청 |
| `/mcp` | GET | SSE 연결 (Streamable HTTP) |
| `/mcp` | DELETE | 세션 종료 |
| `/health` | GET | 서버 상태 확인 |

## 아키텍처

```
사내 AI  ──POST /mcp──▶  DocSpace MCP Server  ──GET /api/──▶  DocSpace API
          ◀──JSON-RPC──   (이 PC:8765)          ◀──JSON────   (166.79.31.248:8082)
```

- MCP 프로토콜: Streamable HTTP (JSON-RPC 2.0)
- 인증: Bearer 토큰 (환경변수 `DOCSPACE_TOKEN`)
- ProseMirror JSON → 평문 텍스트 자동 변환
- 에러 코드 매핑: 307→미인증, 401→인증 실패, 403→권한 없음, 404→없는 페이지