# DocSpace — MCP / 외부 연동 가이드

> 대상: DocSpace 용 MCP 서버(또는 외부 자동화)를 개발하는 사내 팀.
> DocSpace 는 장수명 **API 토큰**(Bearer) + **스코프**(READ/READ_WRITE) + 기존 REST API 를
> 제공한다. 이 문서는 인증·권한·핵심 엔드포인트와 기계가독 명세(OpenAPI) 위치를 정리한다.

## 1. 인증 — API 토큰

사람 세션(쿠키) 없이 프로그램이 호출하려면 API 토큰이 필요하다.

### 토큰 발급 (사람이 1회)

브라우저 로그인 세션(쿠키)으로 발급한다. **토큰으로는 토큰을 발급할 수 없다**(쿠키 전용).

```
POST /api/auth/tokens          (세션 쿠키 필요)
Content-Type: application/json

{ "name": "MCP 읽기 봇", "scope": "READ", "expiresInDays": 90 }
```

응답 (평문 `token` 은 **이 응답에서 단 1회**만 — 재조회 불가, 안전한 곳에 보관):

```json
{
  "id": "ckxxxx",
  "name": "MCP 읽기 봇",
  "token": "dsp_AbCd...(평문, 1회)",
  "tokenPrefix": "dsp_AbCd1234",
  "scope": "READ",
  "expiresAt": "2026-09-07T...",
  "createdAt": "2026-06-09T..."
}
```

- `name`: 식별용 이름(필수).
- `scope`: `READ` | `READ_WRITE`. 생략 시 `READ_WRITE`. (→ §2)
- `expiresInDays`: 생략/0 이면 무기한. 1~3650.

### 토큰 사용

이후 모든 API 호출에 헤더로 싣는다. 쿠키는 보내지 않는다.

```
Authorization: Bearer dsp_AbCd...
```

토큰 인증은 기존 쿠키 보호 라우트와 **공존**한다 — 같은 엔드포인트를 쿠키 또는 토큰으로
호출할 수 있다(하이브리드).

### 토큰 관리 (사람, 쿠키)

```
GET    /api/auth/tokens         본인 토큰 목록(평문 없음 — prefix/scope/만료/lastUsed)
DELETE /api/auth/tokens/:id     폐기(즉시 무효 → 이후 그 토큰 호출은 401)
```

관리자는 전체 토큰을 보고 강제 폐기할 수 있다(`GET/DELETE /api/admin/api-tokens`, ADMIN).

## 2. 스코프 — 최소권한

토큰은 2단계 스코프를 가진다.

| 스코프 | 허용 | 쓰기(POST/PUT/PATCH/DELETE) |
| --- | --- | --- |
| `READ` | GET·HEAD 만 | **403** `insufficient token scope` |
| `READ_WRITE` | 전체 | 허용(아래 권한 범위 내) |

- **MCP 읽기 도구(검색·조회)에는 `READ` 토큰을 권장**한다 — 사고로 인한 쓰기를 원천 차단.
- 쓰기 차단은 **403**(인증은 유효)이라, 401 기반 자동 로그아웃/세션 정리에 걸리지 않는다.
- 스코프는 **권한을 넓히지 않고 좁히기만** 한다(주인 권한 위의 상한선). 즉 `READ_WRITE`
  토큰이라도 주인이 못 하는 작업은 못 한다.

## 3. 권한 — 토큰 = 발급자 권한 승계

토큰 인증 요청은 **발급자(주인)의 권한을 그대로 승계**한다. 별도 권한 체계가 없다.
DocSpace 권한은 3계층(전역 role / 스페이스 멤버십·공개범위 / 페이지 제한) + 그룹 결합이다.

- **권장: MCP 전용 계정**을 만들고 필요한 스페이스/그룹 권한만 부여한 뒤, 그 계정으로
  토큰을 발급하라. 개인 계정 토큰은 그 사람의 전 권한을 그대로 노출한다.
- 비활성 계정(`isActive=false`)의 토큰은 거부된다(401).

## 4. 핵심 엔드포인트

> 경로는 웹 프록시 기준(`/api/*`). 본문(content)이 있는 페이지 응답은 ProseMirror JSON(§5).

| 메서드 | 경로 | 요약 | 스코프 |
| --- | --- | --- | --- |
| GET | `/api/auth/me` | 현재 사용자(토큰 스모크 테스트용) | READ |
| GET | `/api/spaces` | 접근 가능한 스페이스 목록 | READ |
| GET | `/api/pages` | 접근 가능한 페이지 목록 | READ |
| GET | `/api/pages/full-search?q=` | 전문 검색(제목+본문, 필터·정렬) | READ |
| GET | `/api/pages/:id` | 페이지 단건(본문 = ProseMirror JSON) | READ |
| POST | `/api/pages` | 페이지 생성(대상 스페이스 편집 권한 필요) | READ_WRITE |

토큰 발급/관리(쿠키): `POST/GET/DELETE /api/auth/tokens`.

## 5. ⚠️ 페이지 본문 = ProseMirror JSON

페이지 `content` 는 **ProseMirror(TipTap) JSON** 이다 — 평문도, 마크다운도 아니다.
MCP 가 본문을 텍스트로 다루려면 노드 트리에서 텍스트를 추출/직렬화하는 변환이 필요할 수
있다. **이번 사이클은 텍스트 변환 엔드포인트를 제공하지 않는다**(스모크 테스트 후 필요하면
별도 사이클에서 검토). 우선은 검색 결과 스니펫·제목·메타데이터 위주로 다루는 것을 권장.

## 6. 기계가독 명세 (OpenAPI)

`ENABLE_API_DOCS=true` 인 환경에서만 Swagger 로 OpenAPI 명세를 노출한다(미설정/false 면
라우트 미등록 = 404). `NODE_ENV` 와 무관 — 테스트 서버가 `NODE_ENV=production` 이어도
이 플래그만 켜면 열린다. **실운영(AFS)은 플래그를 꺼서(또는 미설정으로) 차단.**

- **UI**: `GET /api/docs` — 엔드포인트 목록 + `Authorize` 버튼에 `dsp_` 토큰을 넣고 바로
  호출 테스트.
- **raw OpenAPI(JSON)**: `GET /api/docs-json` — MCP 서버가 그대로 파싱할 기계가독 명세.

> 보안 스킴 이름은 `api-token`(HTTP Bearer). 핵심 라우트에 `auth / auth-tokens / spaces /
> pages` 태그가 붙어 있다. 전체 라우트가 아니라 연동에 필요한 핵심만 문서화돼 있으며,
> 필요 시 점진적으로 확장한다.
