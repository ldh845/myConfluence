# DocSpace — Cycle 로그 (feature/ldh 전용)

> feature/ldh 브랜치 전용 개발 사이클 로그. 공통 docs/CYCLES.md 와 별개로
> ldh 작업분을 기록한다. 형식은 CYCLES.md 와 동일.

---

## Cycle L1 — 2026-06-02 — ✅ Done (하이브리드 인증 — 로컬 로그인 SSO 병행)
- **제목**: OIDC 단일 로그인에 로컬 ID/PW 경로를 플래그 기반으로 병행 추가
- **카테고리**: BE + FE / 인증
- **커밋**: `23f81f9`(코드), 본 CYCLES-ldh.md
- **변경 파일**:
  - BE: `auth.service.ts`(localLogin), `auth.controller.ts`(POST /auth/login +
    GET /auth/local-login-enabled + 세션 쿠키), `auth/dto/login.dto.ts`(신규),
    `admin.service.ts`(setLocalPassword), `admin.controller.ts`(PATCH
    /admin/users/:id/local-password), `admin/dto/set-local-password.dto.ts`(신규),
    `auth.service.spec.ts`(localLogin 4분기)
  - 설정: `package.json`(bcrypt ^6.0.0 + @types/bcrypt 복원), `.env.example`
    (LOCAL_LOGIN_ENABLED=false)
  - FE: `app/login/page.tsx`(SSO 버튼 아래 ID/PW 폼, 플래그 on 시)
- **검증**: api `tsc --noEmit` EXIT 0, web `tsc --noEmit` EXIT 0, `nest build`
  EXIT 0, jest **158 passed (15 suites)**(기존 154 + localLogin 4). 런타임 로그인
  확인은 미수행(로컬 Postgres 미가동).
- **남은 일**: ~~① LOCAL_LOGIN_ENABLED=true 환경 실제 로그인/SSO전용 거부 브라우저
  확인(VM)~~ ✅ **2026-06-04 VM 검증 완료**(로컬 로그인/SSO전용 거부 확인), ② L2 ✅,
  ③ L3(비번 정책·실패 잠금·셀프 비번 변경). 관리자 비번 설정 화면 UI 는 L2 에서 마감.
- **비고**: 마이그레이션 불필요(User.passwordHash/keycloakId 기존 컬럼 재활용).
  로컬 로그인은 OIDC 콜백과 동일한 docspace_session 쿠키 옵션 재사용 → 이후 요청은
  기존 jwt.strategy 가 SSO/로컬 무관하게 단일 세션으로 검증. 에러 의미: 사용자없음·
  오답=401(계정 존재 비노출), SSO 전용(passwordHash null)=400. bcrypt 네이티브 v6
  가 이 Windows 환경에서 정상 빌드/로드 확인.

---

## Cycle L2 — 2026-06-04 — ✅ Done (관리자 로컬 계정 생성·활성/비활성)
- **제목**: 로컬 계정 발급 + 계정 활성/비활성(퇴사자 차단) 관리 수단 추가
- **카테고리**: BE + FE + DB / 인증·계정관리
- **커밋**: `96c9064`(코드), 본 CYCLES-ldh.md
- **변경 파일**:
  - DB: `schema.prisma`(User.isActive Boolean @default(true)), 마이그레이션
    `20260604000000_user_is_active`(ADD COLUMN, 기존 사용자 전원 활성)
  - BE: `admin.service.ts`(createLocalUser/setActive + listUsers 매핑),
    `admin.controller.ts`(POST /admin/users, PATCH /admin/users/:id/active),
    `admin/dto/create-local-user.dto.ts`·`admin/dto/set-active.dto.ts`(신규),
    `auth.service.ts`(localLogin 비활성 차단 + findOrCreateOidcUser 비활성 거부 +
    AuthUser.isActive), `jwt.strategy.ts`(비활성 세션 즉시 차단),
    `oidc.controller.ts`(비활성 → /login?error=account_disabled redirect),
    `auth.service.spec.ts`·`admin.service.spec.ts`·`jwt.strategy.spec.ts`(신규)
  - FE: `app/(app)/admin/AdminUsers.tsx`(생성 다이얼로그·유형 배지·활성 토글·
    비번 설정/초기화 다이얼로그), `app/login/page.tsx`(account_disabled 안내)
- **로그인 차단 3곳**: ① 로컬 로그인 isActive=false → 401, ② OIDC 콜백 기존 사용자
  비활성 → ForbiddenException → /login?error=account_disabled, ③ jwt.strategy.validate
  비활성 → 401 (7일 JWT 가 비활성화 직후에도 통과하는 구멍 차단).
- **검증**: api `tsc --noEmit` EXIT 0, web `tsc --noEmit` EXIT 0, `nest build`
  EXIT 0, jest **167 passed (16 suites)**(L1 158 + createLocalUser 2 + setActive 3 +
  localLogin 비활성 1 + jwt.strategy 3). 마이그레이션은 SQL 정적 검증 + `prisma validate`
  통과(로컬 Postgres 미가동 → migrate deploy 미수행, VM 배포 시 자동 적용).
- **남은 일**: ~~① LOCAL_LOGIN_ENABLED=true 환경 브라우저 확인(계정 생성→로컬 로그인,
  비활성화→로컬·OIDC·기존 세션 거부, 자기 자신 비활성화 거부)~~ ✅ **2026-06-04 VM 검증
  완료** — 단, 비활성 사용자의 기존 세션에서 캐시 화면 잔상 발견 → **L2 followup 에서 수정**,
  ② L3(비번 정책·실패 잠금 failedLoginCount/lockedUntil·셀프 비번 변경).
- **비고**: L1 남은 일 '관리자 비번 설정 UI' **닫힘**(AdminUsers 비번 설정/초기화
  다이얼로그로 마감). 계정 유형 배지는 hasLocalPassword/isSso 조합으로 SSO/로컬/혼합
  3종 표기. isActive 는 AuthUser 에 포함돼 /auth/me·jwt 검증 양쪽에서 사용. 마이그레이션은
  ADD COLUMN NOT NULL DEFAULT true 단일 구문 — 무중단·테이블 재작성 없음.

### L2 followup — 2026-06-04 — ✅ Done (전역 401 핸들러, 피드백 반영)
- **증상**: 비활성화된 사용자의 기존 세션에서 서버는 모든 API 를 401 로 막지만, 프론트에
  전역 401 처리가 없어 캐시된 셸/이전 데이터 잔상이 보임(뒤로가기/URL 직접 진입 시).
  미들웨어는 docspace_session 쿠키 "존재"만 확인하므로 유효 쿠키를 가진 비활성 사용자는
  통과 → 보안상 데이터는 차단되나 UX 가 "차단 안 된 것"처럼 오해를 부름.
- **원인**: 401 을 전역에서 처리해 세션을 정리/추방하는 경로 부재.
- **수정**:
  - BE: `auth.controller.ts` — `POST /auth/clear-session`(인증 불요). httpOnly 라
    클라이언트가 직접 못 지우는 docspace_session/oidc_id_token 쿠키만 제거. SLO 미경유
    (비활성 사용자는 Keycloak 왕복 실패 가능 → 로컬 쿠키 정리만). `auth.controller.spec.ts`(신규).
  - FE: `lib/auth/session-guard.ts`(신규) — `window.fetch` 1회 패치로 모든 `/api` 401 을
    가로채 clear-session 후 `/login?error=session_expired` 하드 이동. 이 코드베이스는
    raw `fetch("/api/...")` 20 vs `apiFetch` 3 이라 호출부 수정 대신 단일 인터셉터가 견고.
    가드: 인증 경로(login/clear-session/local-login-enabled) 제외 + 이미 /login 이면 미발동
    + 중복 추방 플래그. `shouldEjectOn401` 순수 함수 분리. `app/providers.tsx`(QueryClient
    생성 시 설치), `app/login/page.tsx`(session_expired 안내).
- **커밋**: `bb67817`(코드), 본 CYCLES-ldh.md.
- **검증**: api `tsc --noEmit` EXIT 0, web `tsc --noEmit` EXIT 0, `nest build` EXIT 0,
  jest **171 passed (17 suites)**(L2 167 + clearSession 2 + login gate 2). 마이그레이션 없음.
- **VM 검증 시나리오**: 두 창 → A 창에서 B 계정 비활성 → B 창 아무 동작(이동/새로고침)
  → 즉시 `/login?error=session_expired` 추방 + 안내 확인.
- **비고**: web 에 테스트 러너가 없어 FE 추방 로직은 순수 함수(`shouldEjectOn401`) 설계 +
  VM 시나리오로 커버. window.fetch 패치는 typeof window 가드 + `__dsSessionGuardInstalled`
  중복 설치 가드를 가진다.

### L2 followup 2 — 2026-06-04 — ✅ Done (bfcache 복원 잔상 차단)
- **증상**: followup 1 의 401 추방은 정상. 그러나 추방 후 **뒤로가기** 시 브라우저
  bfcache 가 직전 화면을 메모리에서 복원 — 서버/미들웨어/fetch 를 안 타므로 로그아웃
  상태인데 이전 페이지가 잔상으로 보인다(새 API 호출은 여전히 401, 화면만 잔상).
- **원인**: bfcache 복원은 정상 네비게이션/네트워크를 우회하므로 followup 1 의 fetch
  인터셉터가 발동할 기회가 없다.
- **수정**: `lib/auth/session-guard.ts` 에 `window 'pageshow'` 리스너 추가 —
  `event.persisted`(bfcache 복원)일 때 `/api/auth/me` 를 1회 재검증. 살아있으면 200(무동작),
  죽었으면 401 이 **기존 fetch 패치를 그대로 타고** clear-session + `/login` 추방 수행
  (새 추방 로직 없이 followup 1 흐름 재사용). bfcache 는 JS 힙째 동결하므로 복원된
  `ejecting` 플래그를 리셋해 추방이 다시 발동되게 한다. `/login` 에서는 미발동
  (`shouldRevalidateOnPageShow` 순수 함수로 판정).
- **커밋**: `ddecdbf`(코드), 본 CYCLES-ldh.md.
- **검증**: web `tsc --noEmit` EXIT 0, api jest **171 passed** 회귀 없음(FE 단일 파일 변경).
  마이그레이션 없음.
- **VM 검증 시나리오**: 추방 후 **뒤로가기** → 잠깐 잔상 보였다가 즉시 `/login` 으로
  재추방되면 합격.
- **비고**: web 테스트 러너 부재 → `shouldRevalidateOnPageShow` 순수 함수 설계 + VM
  시나리오로 커버(followup 1 과 동일 패턴).

### L2 followup 3 — 2026-06-04 — ✅ Done (캐시 금지 + 히스토리 정리로 근본 차단)
- **증상**: followup 2 후에도 추방 → **뒤로가기 1회**는 재추방되지만, **더 누르면**
  비로그인 상태로 페이지가 계속 보임. 그 항목에선 pageshow persisted 재검증이 미발동.
- **원인(추정)**: 인증 페이지 HTML 에 캐시 금지 헤더가 없어 bfcache 외 일반 HTTP
  디스크 캐시 복원 경로가 남아 있음(이 경로는 `pageshow.persisted=false` 라 followup 2
  재검증이 안 탐). 개별 가드로 막는 대신 **근본 차단**으로 전환.
- **해법**:
  - `middleware.ts` — 인증된 보호 라우트 통과 응답에 `Cache-Control: no-store` 부착.
    공개 페이지(/login)·정적 자산(_next/static 등)은 조기 return 으로 제외. 효과:
    인증 페이지가 캐시에 저장되지 않아 뒤로가기가 **항상** 미들웨어를 타고, 쿠키 없으면
    무조건 `/login` redirect.
  - `lib/auth/session-guard.ts` — 추방 네비게이션을 `location.href` → `location.replace`
    로 변경. 죽은 페이지 항목을 `/login` 으로 교체해 히스토리에 추방 항목이 쌓이지 않게.
  - 기존 가드(401 인터셉터·pageshow 재검증)는 **이중 방어로 유지**.
- **트레이드오프**: 정상 사용자도 뒤로가기 시 bfcache 즉시 복원 대신 일반 로딩을 거친다
  (약간의 속도 손해를 보안/정확성과 교환).
- **커밋**: `ca74a3a`(코드), 본 CYCLES-ldh.md.
- **검증**: web `tsc --noEmit` EXIT 0, api jest **171 passed** 회귀 없음. 마이그레이션 없음.
- **VM 검증 시나리오**: 추방 후 **뒤로가기 연타** — 몇 번을 눌러도 내용이 안 보이고 항상
  `/login` 이면 합격. (시크릿/캐시 비운 새 세션 권장 — 이전 배포의 캐시된 HTML 이 남아
  있으면 첫 테스트가 오염될 수 있음.)

---

## Cycle L3 — 2026-06-04 — ✅ Done (비밀번호 정책·로그인 실패 잠금·셀프 비번 변경)
- **제목**: Task L-AUTH 최종 단계 — 약한 비번·brute-force·셀프 변경 불가 3구멍 폐쇄
- **카테고리**: BE + FE + DB / 인증·계정보안
- **커밋**: `27ca26f`(코드), 본 CYCLES-ldh.md
- **변경 파일**:
  - DB: `schema.prisma`(User.failedLoginCount Int @default(0), lockedUntil DateTime?),
    마이그레이션 `20260604010000_login_lockout`(ADD COLUMN ×2)
  - BE(정책): `auth/password-policy.ts`(신규, 단일 출처 — 8자+영문+숫자, validate/assert),
    `auth/password-policy.spec.ts`(신규). DTO `create-local-user`·`set-local-password`
    MinLength 제거(정책이 단일 검증), `auth/dto/change-password.dto.ts`(신규)
  - BE(잠금): `auth/login-lockout.ts`(신규, 5회/15분 상수 + isLocked/minutesUntil),
    `auth.service.ts`(localLogin 잠금 흐름 + changeMyPassword + AuthUser.hasLocalPassword),
    `admin.service.ts`(createLocalUser/setLocalPassword 정책 적용, unlockUser, listUsers
    잠금 매핑), `admin.controller.ts`(PATCH /admin/users/:id/unlock),
    `auth.controller.ts`(PATCH /auth/me/password)
  - 테스트: `auth.service.spec.ts`(잠금 5분기 + 셀프변경 4분기), `admin.service.spec.ts`
    (정책·unlock·잠금 매핑), `auth.controller.spec.ts`(changePassword 위임),
    `jwt.strategy.spec.ts`(fixture hasLocalPassword)
  - FE: `lib/auth/useAuth.ts`(hasLocalPassword/isActive), `components/TopNav.tsx`
    (UserMenu '비밀번호 변경' + 다이얼로그), `app/login/page.tsx`(423 잠금 안내),
    `app/(app)/admin/AdminUsers.tsx`(잠금 배지·잠금 해제·정책 힌트)
- **정책(단일 출처)**: 최소 8자 + 영문 1자 + 숫자 1자. 계정 생성·관리자 비번 설정·셀프
  변경 3경로가 모두 `assertPasswordPolicy` 통과. 위반 시 400 + 사유 메시지.
- **잠금**: 연속 5회 오답 → 15분 잠금(상수 분리, 추후 환경변수화 여지). 잠긴 동안 정답도
  423 거부. 성공/잠금 시 카운트 리셋. 관리자 `unlock` 으로 즉시 해제. OIDC 로그인엔 무영향.
- **셀프 변경**: `PATCH /auth/me/password` — SSO 전용 400 / 현재 비번 불일치 401 / 새 비번
  정책 위반 400. SSO 전용 계정은 `hasLocalPassword=false` → 프론트가 메뉴 자체를 숨김.
- **검증**: api `tsc --noEmit` EXIT 0, web `tsc --noEmit` EXIT 0, `nest build` EXIT 0,
  jest **191 passed (18 suites)**(L2 171 + password-policy 7 + localLogin 잠금 5 +
  changeMyPassword 4 + admin unlock 2 + createLocalUser 정책 1 + controller changePassword 1).
  마이그레이션은 `prisma validate` 통과 + SQL 정적 검증(로컬 Postgres 미가동 → migrate
  deploy 미수행, VM 배포 시 자동 적용).
- **남은 일**: 없음 — VM 브라우저 검증 완료(2026-06-04~05). ① 약한 비번 생성/변경 거부,
  ② 5회 오답→잠김(정답도 거부), ③ admin 잠금 해제→로그인, ④ 사용자 메뉴 '비밀번호 변경'
  →새 비번 로그인, ⑤ 순수 SSO 계정(admin·testuser2) 변경 메뉴 미노출까지 전부 합격.
  계정 유형 3종(로컬·혼합·SSO) 메뉴 노출 매트릭스도 검증됨.
- **비고**: 마이그레이션은 ADD COLUMN ×2(NOT NULL DEFAULT 0 / nullable) — 무중단·재작성
  없음. 423 은 NestJS `HttpStatus.LOCKED`. 정책/잠금 기준 변경은 password-policy.ts /
  login-lockout.ts 상수만 손대면 됨. **이로써 Task L-AUTH(L1~L3) 코드 완료.**

---

## Cycle L4 — 2026-06-05 — ✅ Done (계정 역할 관리 — ADMIN/DEVELOPER 변경)
- **제목**: Task L-AUTH 확장 — 로컬 전용 계정의 전역 역할을 DocSpace 에서 변경
- **카테고리**: BE + FE / 인증·계정운영 (마이그레이션 없음 — role 컬럼 기존재)
- **커밋**: `4a47f31`(코드), 본 CYCLES-ldh.md
- **배경**: 로컬 계정(L2)은 생성 시 무조건 DEVELOPER 이고 ADMIN 으로 올릴 길이 없었다.
  전역 역할 source of truth 는 Keycloak realm role(Cycle 48 — OIDC 로그인마다
  `realm_access.roles` 의 'admin' 유무로 `User.role` 동기화)이라 SSO 계정 역할을
  DocSpace 에서 바꾸면 다음 로그인 때 원복된다. → 역할 변경은 **로컬 전용 계정
  (keycloakId=null)에만** 허용, SSO/혼합은 Keycloak 관리로 안내.
- **변경 파일**:
  - BE: `admin/dto/set-role.dto.ts`(신규, `@IsIn(['ADMIN','DEVELOPER'])`),
    `admin/admin.service.ts`(`setRole` — 자기 자신 400 → 404 → SSO 400 → update),
    `admin/admin.controller.ts`(`PATCH /admin/users/:id/role`, `@Req` 로 requester.id)
  - FE: `app/(app)/admin/AdminUsers.tsx`(역할 셀을 인터랙티브 컨트롤로 — 로컬 전용만
    `<select>` ADMIN/DEVELOPER, SSO/혼합은 배지+`Keycloak 관리` 안내, 자기 자신 행은
    배지만; ADMIN 승격 시 확인 다이얼로그; `setRole` mutation → 성공 시 목록 갱신;
    `RoleBadge` 헬퍼 추출)
  - 테스트: `admin/admin.service.spec.ts`(setRole 4분기 — 로컬 변경/SSO 거부/자기
    자신 거부/404), `auth/jwt.strategy.spec.ts`(validate 가 토큰 payload 가 아닌
    **DB role** 을 반영하는지 1분기)
- **즉시 반영(재로그인 불필요)**: `jwt.strategy.validate` 가 L2 부터 매 요청
  `auth.findById(payload.sub)` → `sanitize` 로 **DB 의 role** 을 `req.user.role` 에
  채운다(토큰 payload 의 role 은 사용 안 함). 따라서 역할 변경은 다음 요청부터 즉시
  반영 — **기존 코드가 이미 그렇게 동작**하므로 jwt.strategy 변경 없음(테스트로 보장만 추가).
- **가드 3종**: ① 대상 `keycloakId != null`(SSO/혼합) → 400 "SSO 계정의 역할은 Keycloak
  에서 관리됩니다" ② 자기 자신(`userId === requesterId`) → 400(DB 조회 전 차단)
  ③ 대상 없음 → 404. 허용 역할은 `ADMIN`/`DEVELOPER` 둘뿐(DTO `@IsIn`).
- **검증**: api `tsc --noEmit` EXIT 0, web `tsc --noEmit` EXIT 0, `nest build` EXIT 0,
  jest **196 passed (18 suites)**(L3 191 + setRole 4 + jwt DB role 1). 마이그레이션 없음.
- **남은 일**:
  - VM 브라우저 검증 — ① localtest → ADMIN 변경 → localtest 재로그인 시 톱니바퀴(관리자
    메뉴) 노출, ② localtest 로그인된 상태에서 DEVELOPER 강등 → 새로고침 시 톱니바퀴 사라짐
    (재로그인 불필요 — 즉시 반영), ③ SSO 계정(admin·testuser2) 행 역할 컨트롤 비활성,
    ④ 자기 자신 행 비활성.
  - **역할 변경 감사 로그(deferred)**: 기존 `ActivityLog` 는 페이지/공간 중심 모델이고
    `lib/activity-format.ts` 의 `formatActivity` 에도 `user.role_changed` 케이스가 없어
    `default` 분기에서 원시 타입 문자열로 깨져 보이며 `/activity` "전체" 피드를 오염시킨다.
    스펙 지침("부자연스러우면 구현하지 말고 남은 일에 기록")에 따라 미구현. 도입 시
    `ActivityType` 유니온 + 포매터 케이스 + 피드 필터까지 함께 설계 필요.
- **비고**: `role` 컬럼은 Cycle 43 부터 존재 → 마이그레이션 불필요. Role enum 은 5종
  (ADMIN/PART_LEADER/DEVELOPER/DESIGNER/PM)이나 로컬 계정은 생성 시 DEVELOPER 고정이고
  본 기능도 ADMIN↔DEVELOPER 만 노출 — 나머지 역할은 범위 외. **Task L-AUTH 확장 완료.**

---

## Cycle L4 followup — 2026-06-05 — ✅ Done (API 응답 캐시 금지)
- **제목**: 권한/세션 정보의 브라우저 디스크 캐시 잔재 차단 (API 에 no-store)
- **카테고리**: BE(api) / 인증·캐시 (마이그레이션 없음)
- **커밋**: `6ec7caf`(코드), 본 CYCLES-ldh.md
- **증상(VM 피드백)**: L4 검증 중 역할 변경 즉시 반영이 **최초 1회 미동작** → 재로그인
  후부터 일관 동작. 서버는 매 요청 DB role 을 읽으므로(jwt.strategy, 테스트로 박제)
  서버 로직 문제 아님.
- **원인 추정**: API 응답(`/auth/me` 등)에 캐시 금지 헤더가 없어 브라우저가 디스크
  캐시의 **옛 응답(role 포함)** 을 재사용. 재로그인 시 쿼리스트링/쿠키 변화로 캐시가
  깨지며 비로소 새 값이 반영된 것으로 보임. Cycle L2 followup 3 이 페이지 HTML 에
  적용한 no-store 를 API 응답에도 확장한다.
- **변경 파일**:
  - `common/no-store.middleware.ts`(신규) — 전역 express 미들웨어. 응답에
    `Cache-Control: no-store` 부착. 단, GET 파일 다운로드 라우트는 제외(정규식 매칭).
  - `main.ts` — `app.use(cookieParser())` 직후 `app.use(noStore)` 등록.
  - `common/no-store.middleware.spec.ts`(신규) — 일반 API/뮤테이션/첨부 목록엔 부착,
    다운로드 2경로엔 미부착 검증.
- **적용 방식**: `app.use()` 전역 미들웨어(기존 cookieParser 와 동일 패턴). API 는
  `setGlobalPrefix` 없이 bare 경로로 라우팅되고 web 이 `/api` 를 스트립하므로 미들웨어가
  보는 `req.path` 에는 `/api` 접두가 없다 → `/auth/me`, `/attachments/:id` 형태로 매칭.
- **제외 라우트(파일 다운로드 — 본문 이미지/첨부 성능 보호)**: no-store 미부착, 기존
  (헤더 없음 → 브라우저 휴리스틱 캐시) 동작 유지.
  - `GET /attachments/:id`                        (`AttachmentsController.download`)
  - `GET /share/:token/attachments/:attachmentId` (`PageSharesController.downloadAttachment`)
  - ※ 첨부 **목록**(`GET /pages/:id/attachments`)은 JSON 이므로 no-store 대상(제외 아님).
- **검증**: api `tsc --noEmit` EXIT 0, `nest build` EXIT 0, jest **201 passed (19 suites)**
  (L4 196 + no-store 미들웨어 5). 마이그레이션 없음. web 변경 없음.
- **남은 일**: VM 검증 — ① 역할 변경 → 대상 새로고침 → **항상 즉시 반영(최초 포함)**,
  ② F12 Network 의 `/api/auth/me` 응답 헤더에 `Cache-Control: no-store` 확인,
  ③ 본문 이미지 있는 페이지 새로고침 → 이미지가 캐시 로드(안 느려짐) 확인.
- **비고**: api 만 변경(web 무관). 다운로드 라우트 이름 변경 시 미들웨어 정규식도 함께
  갱신 필요(주석에 명시). no-store 는 mutation/redirect 응답에 붙어도 무해(캐시 안 됨).

---

## Cycle L5 — 2026-06-05 — ✅ Done (권한 가드 구멍 보강 — enforcement 빈틈 폐쇄)
- **제목**: Task L-AUTHZ 1단계 — apps/api 권한 enforcement 전수 조사 + 보안 핵심 폐쇄
- **카테고리**: BE(api) / 인가(authorization) (마이그레이션 없음 — 스키마 변경 불필요)
- **커밋**: `4a28a06`(코드), 본 CYCLES-ldh.md
- **배경**: 기존 3계층 권한(전역 role(48)/스페이스 멤버십·공개범위(74-A)/페이지 제한(83))은
  본문 CRUD 엔 잘 적용됐으나, 부속 리소스(첨부·다이어그램·버전·댓글·리액션·활동)와 일부
  경로에 가드가 누락돼 있었다(Task I 잔여). 전역 APP_GUARD 가 없어 컨트롤러별로 가드를
  걸어야 하는데 일부가 빠진 것.

### 1단계 산출물 — 전수 인벤토리 (18 컨트롤러 ~70 라우트)
정상 가드(pages 본문 CRUD·spaces 멤버/설정/바로가기·admin/auth·notifications/saves 등
~40개)는 생략. **발견된 구멍**과 처리:

| # | 엔드포인트 | 보강 전 | 요구 권한 | 보강 후 | 처리 |
|---|---|---|---|---|---|
| 🔴1 | `POST /pages/:pageId/attachments` | 가드 0 | 페이지 편집 | JwtAuthGuard + `assertCanEditPage` | **L5** |
| 🔴2 | `DELETE /attachments/:id` | 가드 0 | 페이지 편집 | JwtAuthGuard + `assertCanEditPage`(첨부→page) | **L5** |
| 🔴3 | `PATCH /diagrams/:id` | 가드 0 | 페이지 편집 | JwtAuthGuard + `assertCanEditPage`(diagram→page) | **L5** |
| 🔴4 | `DELETE /diagrams/:id` | 가드 0 | 페이지 편집 | JwtAuthGuard + `assertCanEditPage` | **L5** |
| 🟠5 | `GET /pages/:pageId/attachments` | 가드 0 | 페이지 읽기 | OptionalJwt + `assertCanViewPage` | **L5** |
| 🟠6 | `GET /attachments/:id`(다운로드) | 가드 0 | 페이지 읽기 | OptionalJwt + `assertCanViewPage`(첨부→page) | **L5** |
| 🟠7 | `GET /diagrams/:id` | 가드 0 | 페이지 읽기 | OptionalJwt + `assertCanViewPage` | **L5** |
| 🟠8 | `GET /pages/:id/diagrams` | 가드 0 | 페이지 읽기 | OptionalJwt + `assertCanViewPage` | **L5** |
| 🟠9 | `GET /pages/:id/versions` | 가드 0 | 페이지 읽기 | OptionalJwt + `assertCanViewPage` | **L5** |
| 🟠10 | `GET /pages/trash` | 가드 0 | 가시성 필터 | JwtAuthGuard + `pageVisibilityWhere` | **L5** |
| 🟠11 | `GET /pages/:id/comments` | 가드 0 | 페이지 읽기 | OptionalJwt + `assertCanViewPage` | **L5** |
| 🟠12 | `GET /pages/:id/reactions` | 가드 0 | 페이지 읽기 | OptionalJwt + `assertCanViewPage` | **L5** |
| 🟠13 | `GET /comments/:id/reactions` | 가드 0 | 페이지 읽기 | OptionalJwt + `assertCanViewPage`(댓글→page) | **L5** |
| 🟠14 | `GET /activities` | 가드 0 | 가시성 필터 | OptionalJwt + 스페이스 가시성 OR(null) 필터 | **L5** |
| ⚪15 | `POST /spaces` | OptionalJwt(익명 생성 가능) | 인증 | JwtAuthGuard(생성자 ADMIN 멤버) | **L5** |
| 🟡16 | `POST /pages/:pageId/comments` | JwtAuthGuard만 | 페이지 읽기 | (정책 검토) | L5-2 |
| 🟡17 | `PATCH·DELETE /comments/:id` | JwtAuthGuard만(소유권 X) | 소유자/관리 | (정책 검토) | L5-2 |
| 🟡18 | `POST /comments/:id/resolve·unresolve` | JwtAuthGuard만 | 페이지 편집 | (정책 검토) | L5-2 |
| 🟡19 | `POST /reactions/toggle` | JwtAuthGuard만 | 페이지 읽기 | (정책 검토) | L5-2 |
| 🟡20 | `POST /pages/:id/watch` | JwtAuthGuard만 | 페이지 읽기 | (정책 검토) | L5-2 |
| 🟡21 | `POST·DELETE /pages/:id/share`·`/rotate` | JwtAuthGuard만 | 페이지 편집 | (정책 검토) | L5-2 |
| 🟡22 | `PATCH /pages/:id/status` | JwtAuthGuard+작성자/ADMIN | 페이지 편집 | (정책 검토) | L5-2 |
| 🟡23 | `PATCH /spaces/:id`(setHomePage) | JwtAuthGuard만 | 공간 관리 | (정책 검토) | L5-2 |

- **인지했으나 미수정(근거)**: `GET /users`·`/users/:id`(멘션 디렉터리, 비밀 미포함),
  `GET .../save`·`/watch`·saves 토글(본인 데이터 probe, 저위험) — 필요 시 L5-2 검토.
- **오탐 정정**: 에이전트가 의심한 spaces 멤버/설정/바로가기·페이지 제한 멤버 라우트는
  서비스 계층에서 `assertCanManage`/`assertCanManagePageRestriction` 호출 확인 → 정상.

### 2단계 — 보강 (🔴4 + 🟠10 + ⚪1 = 15곳, 8 컨트롤러)
- **신규 프리미티브**: `SpacePermissionService.assertCanViewPage(pageId, user)` — 기존
  `assertCanEditPage` 의 읽기판(페이지 로드 → 공간 `assertCanView` → VIEW_EDIT 제한 검사).
  거의 모든 읽기 보강이 이 1개를 재사용. PUBLIC 공간은 그대로 통과(공개 흐름 무변화).
- **변경 파일**:
  - `spaces/space-permission.service.ts` — `assertCanViewPage` 추가.
  - `pages/pages.service.ts` — `listTrash(actor)` 가시성 필터. `pages/pages.controller.ts`
    — trash JwtAuthGuard, diagrams/versions 목록 OptionalJwt + `assertCanViewPage`.
  - `attachments/*` — controller 가드 전면(업로드/삭제=편집, 목록/다운로드=읽기) +
    module 에 AuthModule·SpacePermissionModule.
  - `diagrams/*` — controller 가드(조회=읽기, 수정/삭제=편집, diagram→pageId 해석) + module.
  - `comments/comments.controller.ts`·module — 목록 읽기 가드(쓰기는 L5-2).
  - `reactions/reactions.controller.ts`·module — 목록 읽기 가드(toggle 은 L5-2).
  - `activities/*` — controller OptionalJwt + 가시성 필터, service `list` 에 옵션
    `visibilityWhere`(감사 로그 `getAuditLog` 는 미전달 → 무영향).
  - `spaces/spaces.controller.ts` — `POST /spaces` OptionalJwt→Jwt.
- **POST /spaces 재검토 결과**: 개인 공간 자동 생성은 별도 메서드 `getOrCreatePersonal`
  (OIDC 콜백·`GET /spaces/personal`)을 쓰므로 `create` 컨트롤러에 인증을 걸어도 안 깨진다.
  컨트롤러가 유일 호출자, 내부 서비스-서비스 호출 없음 → **깨지는 흐름 없음**. 익명
  생성(소유자·멤버 없는 ownerless 공간) 차단은 개선.

### 3단계 — 테스트 (+20, 21 suites)
- `space-permission.service.spec.ts` — `assertCanViewPage` 5분기(404 / PUBLIC 익명 통과 /
  PRIVATE 비멤버 403 / VIEW_EDIT 비제한멤버 403 / 제한멤버 통과).
- `attachments/attachments.controller.spec.ts`(신규) — 업로드·목록·다운로드·삭제 권한
  확인 + 거부 시 부작용(저장/스트림/삭제) 미발생 7분기.
- `diagrams/diagrams.controller.spec.ts`(신규) — 조회/수정/삭제 권한 + 거부 전파 5분기.
- `activities/activities.service.spec.ts` — `visibilityWhere` AND 결합 3분기.

- **검증**: api `tsc --noEmit` EXIT 0, `nest build` EXIT 0, jest **221 passed (21 suites)**
  (L4 followup 201 + assertCanViewPage 5 + attachments ctrl 7 + diagrams ctrl 5 +
  activities visibility 3). 마이그레이션 없음. web 변경 없음. 기존 201 전부 회귀 없음.
- **남은 일**:
  - **L5-2**: 🟡 16~23(인증됐으나 공간/페이지 권한 미검사 쓰기) — 정책 판단(뷰어 댓글
    허용 범위·댓글 수정 권한·상태 변경 권한 등) 후 별도 사이클.
  - **L5 VM 검증**(보강된 구멍 기준):
    ① 비멤버로 비공개 공간 첨부 업로드 → 403(디스크/DB 미기록),
    ② 비멤버로 비공개 첨부 다운로드 → 403,
    ③ 비멤버로 비공개 페이지 `PATCH /diagrams/:id` → 403(내용 무변화),
    ④ 비멤버의 휴지통·활동 피드에 비공개 항목 미노출,
    ⑤ 비멤버로 비공개 페이지 버전 이력·댓글 목록 → 403,
    ⑥ 전체공개(PUBLIC) 공간은 위 전부 기존대로 정상 — 회귀 없음.
- **비고**: 전역 APP_GUARD 부재 → 컨트롤러별 가드가 원칙. `SpacePermissionModule` 은 의존
  없는 독립 모듈이라 어느 컨트롤러 모듈이든 import 로 주입(순환 의존 無). DI 와이어링은
  `nest build` 로 컴파일 검증(런타임 부트스트랩은 DB 필요 → VM 에서 확인). 첨부/다이어그램
  은 자원 id 로 키되므로 컨트롤러에서 소속 pageId 해석 후 권한 판정.

---

## Cycle L5-2 — 2026-06-05 — ✅ Done (쓰기 경로 권한 정책 적용 — 🟡 13개)
- **제목**: Task L-AUTHZ 2단계 — L5 인벤토리의 🟡(인증됐으나 권한 미검사 쓰기) 폐쇄
- **카테고리**: BE(api) / 인가(authorization) (마이그레이션 없음 — 기존 프리미티브 재사용)
- **커밋**: `77d1d3b`(코드), 본 CYCLES-ldh.md
- **배경**: L5 에서 무인증 쓰기·데이터 누수(🔴🟠⚪, VM 검증 합격)를 닫았고, 남은 🟡 13개
  — "인증은 됐으나 공간/페이지 권한 미검사 쓰기" — 를 정책 검토 후 본 사이클에서 적용.
  마이그레이션·신규 프리미티브 없이 기존 `assertCanViewPage`/`assertCanEditPage`/
  `assertCanManage` 재사용.

### 확정 정책 (사용자 검토 완료 — 최종 결정)
| # | 엔드포인트 | 적용 권한 | 위치 | 비고 |
|---|---|---|---|---|
| 1 | `POST /pages/:pageId/comments` | `assertCanViewPage` | comments.ctrl | 뷰어도 댓글 가능 |
| 2 | `PATCH /comments/:id`(수정) | **본인만** | comments.ctrl | 공간관리자·전역 ADMIN 도 불가(내용 조작 방지). *초기안에서 변경* |
| 3 | `DELETE /comments/:id` | 본인 OR `assertCanManage` | comments.ctrl | 공간 관리(전역 ADMIN 포함) 모더레이션 허용 |
| 4 | `POST /comments/:id/resolve` | `assertCanEditPage` | comments.ctrl | |
| 5 | `POST /comments/:id/unresolve` | `assertCanEditPage` | comments.ctrl | |
| 6 | `POST /reactions/toggle` | `assertCanViewPage` | reactions.ctrl | comment 면 comment→page 해석 |
| 7 | `POST /pages/:id/watch` | `assertCanViewPage` | watches.ctrl | 조회/해제(본인 데이터)는 그대로 |
| 8 | `POST /pages/:id/share` | `assertCanEditPage` | page-shares.ctrl | |
| 9 | `POST /pages/:id/share/rotate` | `assertCanEditPage` | page-shares.ctrl | |
| 10 | `DELETE /pages/:id/share` | `assertCanEditPage` | page-shares.ctrl | |
| 11 | `PATCH /pages/:id/status` | `assertCanEditPage` | pages.service | 기존 "작성자/ADMIN" 임시 정책 제거·일원화 — 편집 권한자면 누구나 |
| 12 | `PATCH /spaces/:id`(setHomePage) | `assertCanManage` | spaces.service | user 인자 추가 |

- **변경 파일**:
  - `comments/comments.service.ts` — `getContext(id)`(댓글→{pageId,spaceId,authorId}) 추가.
    `comments/comments.controller.ts` — 정책 1~5 적용(작성/수정/삭제/resolve/unresolve).
  - `reactions/reactions.controller.ts` — toggle 정책 6(`resolvePageId` 로 page/comment 해석).
  - `watches/watches.controller.ts`·module — 정책 7(+SpacePermissionModule).
  - `page-shares/page-shares.controller.ts`·module — 정책 8~10(+SpacePermissionModule).
  - `pages/pages.service.ts` — `changeStatus` 정책 11(작성자/ADMIN 블록 제거 →
    `assertCanEditPage` 일원화).
  - `spaces/spaces.service.ts`(`setHomePage` user 인자 + `assertCanManage`)·
    `spaces/spaces.controller.ts`(`@Req` 전달).
- **enforcement 위치**: 자원 id→page 해석이 필요한 댓글/리액션은 컨트롤러에서 처리(L5
  패턴). `changeStatus` 는 기존 service 가드+테스트가 있어 service 에서 일원화,
  `setHomePage` 도 service 에서. 나머지는 컨트롤러.
- **테스트 (+24, 25 suites)**:
  - `comments.controller.spec.ts`(신규) — 정책 1~5, 특히 **2번(전역 ADMIN 도 타인 댓글
    수정 403)** 명시 13분기.
  - `reactions.controller.spec.ts`(신규) — toggle page/comment 해석 + 거부 3분기.
  - `watches.controller.spec.ts`(신규) — watch 읽기 권한 2분기.
  - `page-shares.controller.spec.ts`(신규) — 발급/회전/취소 편집 권한 6분기.
  - `spaces.service.spec.ts` — `setHomePage` manage 권한 2분기.
  - `pages.service.spec.ts` — `changeStatus` 재작성: **11번 핵심(작성자 아닌 편집자 허용 /
    비편집자 403)** 반영.
- **검증**: api `tsc --noEmit` EXIT 0, `nest build` EXIT 0, jest **245 passed (25 suites)**
  (L5 221 + 신규 24). 마이그레이션 없음. web 변경 없음. 기존 221 회귀 없음(changeStatus
  기존 테스트는 정책 변경에 맞춰 갱신).
- **남은 일**:
  - L5-2 VM 검증: ⑦ 뷰어 공개 공간 댓글 OK/비공개 비멤버 403, ⑧ 남의 댓글 수정 403(관리자
    포함)·본인 OK, ⑨ 남의 댓글 삭제 본인/관리자 OK·그 외 403, ⑩ 비편집자 상태변경 403·
    편집자 OK, ⑪ 비편집자 공유 발급·resolve 403, ⑫ 비관리자 setHomePage 403, ⑬ PUBLIC
    공간 댓글·리액션·watch 회귀 없음.
  - L6~L8(그룹 권한) 설계.
- **비고**: 정책 2(수정 본인만)는 초기 제안(본인 OR 관리자)에서 사용자 검토로 변경 —
  타인 댓글 내용 조작 방지가 모더레이션(삭제만 관리자 허용)보다 우선. 정책 11 로 페이지
  상태 변경이 "작성자 한정"에서 "편집 권한자"로 넓어짐(편집자 협업 자연스러움). **이로써
  Task L-AUTHZ enforcement 보강(L5+L5-2) 코드 완료 — 이후는 그룹 권한(L6~).**

---

## Cycle L6 — 2026-06-05 — ✅ Done (그룹 모델 + 관리자 그룹 관리)
- **제목**: Task L-AUTHZ 3단계 — 조직(부서/팀) 단위 운영을 위한 그룹 '그릇'
- **카테고리**: BE + FE + DB / 인가(그룹 모델) (마이그레이션 1건)
- **커밋**: `b53f29d`(코드), 본 CYCLES-ldh.md
- **배경**: 권한 부여가 개인 단위뿐이라 조직 단위 운영 불가. L6 는 그룹의 모델 +
  관리자 관리 화면까지만. **권한 판정 로직은 일절 미변경** — 그룹이 실제 권한에 영향
  주는 결합은 L7(SpaceMemberGroup + max). 결합 정책(L7 예고): 개인 vs 그룹 높은 쪽
  승리(max), deny 규칙 없음.
- **DB(마이그레이션 1건 `20260605000000_groups`)**:
  - `enum GroupSource { LOCAL KEYCLOAK }`.
  - `Group`(@@map `groups`): id/name(unique)/description?/source(@default LOCAL)/
    createdAt/updatedAt. "Group" SQL 예약어 회피용 @@map.
  - `GroupMember`(@@map `group_members`): groupId+userId 복합 PK, 양쪽 FK Cascade.
  - `User.groupMemberships` 역관계 추가.
- **BE(`admin/groups.*`, 전부 RolesGuard ADMIN — AdminController 와 동일 가드)**:
  - `GET /admin/groups`(멤버 수 포함) · `POST /admin/groups`(중복 name 409) ·
    `PATCH /admin/groups/:id`(KEYCLOAK 403, name 변경 시 중복 409) ·
    `DELETE /admin/groups/:id`(멤버십 cascade, KEYCLOAK 403) ·
    `GET /admin/groups/:id/members` · `POST /admin/groups/:id/members`(KEYCLOAK 403) ·
    `DELETE /admin/groups/:id/members/:userId`(KEYCLOAK 403).
  - **중복 멤버 추가 정책**: **idempotent**(409 대신) — `{ok:true, alreadyMember:true}`
    반환, create 미호출. UI 가 같은 사람을 또 추가해도 무해.
  - **source 보호 가드**: 수정·삭제·멤버 편집 진입점이 공통 `loadLocal()` 통과 →
    `source=KEYCLOAK` 이면 403. L8 동기화 그룹을 DocSpace 에서 못 건드리게 선반영
    (현재 생성은 전부 LOCAL 이라 실사용 영향 없음).
  - GroupsController/Service 를 AdminModule 에 등록.
- **FE(`/admin` '그룹' 탭)**:
  - `AdminGroups.tsx`(신규) — 그룹 목록(이름·설명·유형 배지·멤버 수) + '+ 그룹 생성'
    다이얼로그 + 그룹 선택 시 멤버 패널(목록 + `UserSearchCombobox` 추가/제거) + 삭제
    (확인 다이얼로그). KEYCLOAK 그룹은 삭제·멤버 편집 비활성 + 안내.
  - `admin/page.tsx` Tab 에 `groups` 추가, `TopNav` 톱니바퀴 드롭다운에 '그룹 관리'
    (`?tab=groups`).
- **테스트(+16)**: `groups.service.spec.ts`(신규) — list 평탄화, create 중복 409,
  update KEYCLOAK 403·name 중복 409, remove KEYCLOAK 403·404, addMember KEYCLOAK 403·
  user 404·신규 create·idempotent, removeMember KEYCLOAK 403, listMembers 평탄화.
  ※ '비ADMIN 403' 은 컨트롤러 클래스 `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')`
  로 강제(다른 /admin 라우트와 동일) — RolesGuard 는 `roles.guard.spec` 가 커버.
- **검증**: api `tsc --noEmit` EXIT 0, web `tsc --noEmit` EXIT 0, `nest build` EXIT 0,
  jest **261 passed (26 suites)**(L5-2 245 + groups 16). 마이그레이션은 `prisma generate`
  + `prisma validate` 통과 + SQL 정적 검증(로컬 Postgres 미가동 → `migrate deploy` 미수행,
  VM 배포 시 자동 적용).
- **남은 일**:
  - L6 VM 검증: ① admin 그룹 탭 → 생성 → 멤버 추가/제거 → 삭제, ② localtest(DEVELOPER)
    /admin 접근 불가 그대로, ③ 기존 공간 권한·페이지 기능 영향 없음(판정 로직 무변경).
  - L7(그룹↔공간 권한 max 결합) 구현, L8(Keycloak 동기화) 설계.
- **비고**: 마이그레이션은 신규 테이블 2 + enum 1(무중단·재작성 없음). 그룹은 아직 어떤
  권한에도 연결 안 됨 → 본 사이클 배포는 기존 동작에 영향 0. L8 보호 가드를 미리 넣어
  L8 도입 시 그룹 BE 변경 불필요.

---

## Cycle L7 — 2026-06-05 — ✅ Done (그룹을 스페이스 권한에 적용)
- **제목**: Task L-AUTHZ 4단계 — 그룹↔스페이스 권한 결합(개인∪그룹 max)
- **카테고리**: BE(판정 로직) + FE + DB / 인가 (마이그레이션 1건) ⚠️ 회귀 민감
- **커밋**: `baebe72`(코드), 본 CYCLES-ldh.md
- **배경**: L6 그룹 그릇을 실제 스페이스 권한에 연결. 판정 로직(SpacePermissionService)을
  건드리는 사이클이라 **기존 개인 권한 동작 불변**이 최우선.
- **결합 규칙(확정)**: 사용자의 공간 유효 역할 = **max(개인 SpaceMember 역할, 소속 그룹들이
  그 공간에 부여받은 역할들)**. 높은 쪽 승리, **deny 규칙 없음**(그룹은 역할을 올려주기만
  하고 빼앗지 않음). 역할 등급 ADMIN(3) > EDITOR(2) > VIEWER(1) > 없음(0).
- **DB(마이그레이션 1건 `20260605010000_space_member_group`)**:
  - `SpaceMemberGroup`(@@map `space_member_groups`): spaceId+groupId 복합 PK,
    role(기존 `SpaceRole` enum 재사용), 양쪽 FK Cascade. `Space.memberGroups`/
    `Group.spaceGrants` 역관계 추가. 기존 `SpaceMember` 그대로(개인 권한 유지).
- **BE 판정 로직 — 단일 변경점**:
  - `SpacePermissionService.loadAccess` 한 곳만 확장: 개인 역할 조회 후 `spaceMemberGroup.
    findMany({ where: { spaceId, group: { members: { some: { userId } } } } })`(단일 쿼리,
    N+1 없음)로 소속 그룹 부여 역할을 모아 `higherRole` 로 max 결합 → `access.role` 에 반영.
  - **canView/canEdit/canManage·assertCan\* 가 전부 `access.role` 만 보므로 자동 반영**
    (한 곳 수정으로 전부 적용, 시그니처 무변경).
  - `roleRank`/`higherRole` 헬퍼 추가.
  - 가시성 필터 `accessibleSpaceOr` 에 그룹 기반 PRIVATE 가지 추가(접근 가능과 목록 노출
    일관). 기존 OR 가지는 그대로 — **없던 접근만 더해짐(약화 없음)**.
- **보존한 기존 분기(약화 없음 명시)**: 전역 ADMIN override / PUBLIC 통과 / PERSONAL
  소유자 판정 / PRIVATE 비멤버 차단 / 개인 역할 비교 — 전부 그대로. 그룹이 비면
  `loadAccess` 결과가 종전과 동일(개인 권한 불변).
- **BE 그룹 권한 부여 API(공간 manage 가드)**: `GET/POST/PATCH/DELETE
  /spaces/:id/member-groups[/:groupId]`(목록/부여(idempotent upsert)/역할변경/제거).
  부여 시 그룹 없으면 404. + `GET /groups`(인증, ADMIN 아님 — 공간 관리자가 그룹 선택용,
  `GroupsDirectoryController`. id/name/source 만).
  - ※ 마지막 ADMIN 보호는 개인 SpaceMember 기준만 유지(그룹 제거로 잠기지 않음).
- **FE**: `SpaceMemberGroupsPanel.tsx`(신규) — 공간 '권한' 탭에 '그룹' 섹션(부여 목록·
  역할 변경·제거 + 그룹 선택 드롭다운 추가). `SpaceSettings` 권한 탭을 '멤버(개인)' +
  '그룹' 2섹션으로 구성.
- **테스트(+12, 회귀 방어)**:
  - `space-permission.service.spec.ts` — **기존 canView/Edit/Manage 테스트 전부 통과
    (개인 권한 불변 증명)** + L7 결합 6분기(그룹 뷰어→canView OK/canEdit 거부, 그룹
    편집자→canEdit OK, 개인 뷰어+그룹 편집자→EDITOR, 개인 편집자+그룹 뷰어→EDITOR(강등
    안 됨), 다중 그룹 max=ADMIN, 그룹 없는 비공개→차단 유지). 가시성 필터 기대값에 그룹
    가지 반영.
  - `spaces.service.spec.ts` — member-group CRUD 6분기(404/upsert/update/delete/manage 403).
- **검증**: api `tsc` EXIT 0, web `tsc` EXIT 0, `nest build` EXIT 0, jest **273 passed
  (26 suites)**(L6 261 + space-permission 6 + spaces member-groups 6). 마이그레이션은
  `prisma generate` + `prisma validate` 통과 + SQL 정적 검증(로컬 Postgres 미가동 →
  `migrate deploy` 미수행, VM 배포 시 자동 적용).
- **남은 일**:
  - L7 VM 검증: ① 비공개 공간에 그룹을 편집자로 부여 → 그룹 멤버(개인 권한 없는 사용자)
    편집 가능, ② 그룹/그룹권한 제거 → 접근 불가, ③ 개인 편집자+그룹 뷰어 → 편집 유지(max),
    ④ 개인 권한만 쓰던 공간 변화 없음(회귀).
  - L7-2(페이지 제한 그룹 적용), L8(Keycloak 동기화).
- **비고**: 판정 결합을 `loadAccess` 단일 지점에 둔 게 핵심 — 분기마다 손대지 않아 회귀
  표면 최소. 그룹 부여는 KEYCLOAK 그룹도 가능(공간측 부여이지 그룹 수정이 아님). 페이지
  단위 제한(83) 그룹 적용은 범위 분리(L7-2).

---

## Cycle L7-2 — 2026-06-08 — ✅ Done (페이지 단위 제한에 그룹 적용)
- **제목**: Task L-AUTHZ 4단계 — 페이지 제한(83)↔그룹 결합(개인∪그룹 max)
- **카테고리**: BE(판정 로직) + FE + DB / 인가 (마이그레이션 1건) ⚠️ 회귀 민감
- **커밋**: `5dad659`(코드), 본 CYCLES-ldh.md
- **배경**: Cycle 83 페이지 단위 제한(restrictionMode NONE/EDIT/VIEW_EDIT +
  PageRestriction 사용자별 VIEW/EDIT)이 개인 단위뿐 → L7(공간) 과 같은 패턴으로 그룹을
  제한 멤버로 추가 가능하게 확장. 판정부를 건드리므로 **개인 제한 동작 불변**이 최우선.
- **결합 규칙(확정)**: 페이지 제한 유효 역할 = **max(개인 PageRestriction, 소속 그룹들의
  PageRestrictionGroup)**. EDIT > VIEW, **deny 없음**(그룹은 멤버십을 더하고 역할을
  올리기만). 둘 다 없으면 '제한 멤버 아님'. 작성자/공간 관리자/전역 ADMIN 우회 그대로.
- **DB(마이그레이션 1건 `20260606000000_page_restriction_group`)**:
  - `PageRestrictionGroup`(@@map `page_restriction_groups`): pageId+groupId 복합 PK,
    role(기존 `PageRestrictionRole` enum 재사용), 양쪽 FK Cascade(Page, groups).
    `Page.restrictionGroups`/`Group.pageRestrictions` 역관계 추가. 기존
    `PageRestriction` 무변경(개인 제한 유지).
- **BE 판정 로직(변경점 최소화)**:
  - 신규 헬퍼 `effectivePageRestrictionRole(pageId, userId)` — 개인 `pageRestriction.
    findUnique` 후 EDIT 이면 즉시 반환(최댓값 확정), 아니면 `pageRestrictionGroup.
    findMany({ where: { pageId, group: { members: { some: { userId } } } } })`(단일 쿼리,
    N+1 없음)로 소속 그룹 제한 역할을 모아 `higherRestrictionRole` 로 max 결합.
  - `assertCanEditPage`: 기존 개인 `pageRestriction` 직접 조회 → `effective...Role` 호출,
    `EDIT` 만 통과(종전과 동일 조건, 그룹만 합류).
  - `assertCanViewPageRestriction`: 기존 개인 조회 → `effective...Role`, `null` 이면 403
    (역할 무관 멤버이면 보기 통과 — 종전과 동일).
- **보존한 기존 분기(약화 없음 명시)**: NONE 모드 통과 / 전역 ADMIN override / 작성자
  통과 / 공간 관리자(canManage) 통과 — 전부 그대로. 그룹이 비면 effective 결과가 개인
  제한만으로 결정 = 종전과 동일(개인 제한 불변).
- **BE 제한 관리 API(83 followup 3 원자 PATCH 구조 유지)**:
  - `GET /pages/:id/restriction` 응답에 `groups: [{groupId, name, role}]` 추가.
  - `PATCH /pages/:id/restriction` body 에 `groups` 배열 합류 — mode+members+groups
    원자 교체(트랜잭션에 `pageRestrictionGroup` deleteMany+createMany 추가). 모드만
    변경(members/groups 미지정) + 모드 변경 시 개인·그룹 둘 다 초기화. NONE 모드는 전부
    비움, EDIT 모드는 그룹 role=EDIT 강제. 그룹 존재 검증(없으면 400).
  - 그룹 선택은 L7 의 `GET /groups`(인증 디렉터리) 재사용 — 신규 엔드포인트 없음.
- **FE(`RestrictButton`)**: 제한 다이얼로그 EDIT/VIEW_EDIT 영역에 '허용 그룹' 섹션 추가
  (그룹 선택 드롭다운=`GET /api/groups`, 이미 추가된 그룹 제외, VIEW_EDIT 는 역할 선택,
  '그룹' 배지·역할 표시·× 제거). 기존 draft→'적용' 원자 흐름에 `draftGroups` 합류,
  isDirty/모드전환 초기화에 그룹 포함. `types.ts` 에 `PageRestrictionGroup` +
  `PageRestrictionState.groups` 추가.
- **테스트(+14, 회귀 방어)**:
  - `space-permission.service.spec.ts` — assertCanViewPage `build()` 에
    `pageRestrictionGroup.findMany` 빈 배열 모킹(**기존 VIEW_EDIT 제한 테스트 전부 통과
    = 개인 제한 불변**) + L7-2 결합 9분기(그룹 EDIT→편집 OK, 비멤버 403, 그룹 VIEW만→
    편집 403, 개인 VIEW+그룹 EDIT→max=EDIT, 작성자·공간관리자·전역 ADMIN 우회 불변 3건,
    VIEW_EDIT 그룹 VIEW→보기 OK, 비멤버 보기 403).
  - `pages.service.spec.ts` — `updateRestrictionMode` 그룹 5분기(모드 변경 시 개인+그룹
    초기화, 그룹 원자 교체+존재검증, 그룹 404→400, EDIT 모드 role=EDIT 강제, NONE 모드
    그룹 제외).
- **검증**: api `tsc` EXIT 0, web `tsc` EXIT 0, `nest build` EXIT 0, jest **287 passed
  (26 suites)**(L7 273 + 제한그룹 결합 9 + updateRestrictionMode 5). 마이그레이션은
  `prisma generate` + `prisma validate` 통과 + SQL 정적 검증(로컬 Postgres 미가동 →
  `migrate deploy` 미수행, VM 배포 시 자동 적용).
- **남은 일**:
  - L7-2 VM 검증: ① '편집 제한'+그룹(EDIT) → 그룹 멤버 편집 가능·비멤버 보기만,
    ② '보기+편집 제한'+그룹(VIEW) → 그룹 멤버 보기만·그룹 밖 페이지 403, ③ 모드 변경 시
    그룹 멤버십 초기화, ④ 제한 없는·개인 제한만 쓰는 페이지 변화 없음(회귀).
  - L8(Keycloak 그룹 동기화) — L6 에서 `source=KEYCLOAK` 보호 가드 선반영 완료 → 동기화
    로직만 추가.
- **비고**: L7(공간) 과 동일하게 판정 결합을 단일 헬퍼(`effectivePageRestrictionRole`)에
  모아 회귀 표면 최소화. 개인 EDIT 면 그룹 조회 생략(쿼리 절약). 마이그레이션은 신규
  테이블 1(enum 재사용·기존 테이블 무변경) → 본 사이클 배포는 그룹 미연결 페이지에 영향 0.
