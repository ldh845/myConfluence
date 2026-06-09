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

---

## Cycle L8 — 2026-06-08 — ✅ Done (Keycloak 그룹 동기화)
- **제목**: Task L-AUTHZ 최종 단계 — 로그인 시 Keycloak 그룹을 DocSpace 멤버십에 자동 동기화
- **카테고리**: BE(인증/동기화) + infra(realm 시드) / 인가 (마이그레이션 없음)
- **커밋**: `7d08aa4`(코드), 본 CYCLES-ldh.md
- **배경**: L6(그룹 그릇)·L7/L7-2(그룹↔공간·페이지 권한) 완성됐으나 멤버십이 수동.
  L8 은 Keycloak 그룹을 **OIDC 로그인 시점**(Cycle 48 realm role 동기화와 동일 패턴)에
  자동 동기화. 로컬 로그인(localLogin)에는 무관.
- **동기화 규칙(확정)**:
  - **시점**: `findOrCreateOidcUser`(매 OIDC 로그인). claim `groups`(string[]) 기반.
  - **undefined(claim 없음)** → 스킵(기존 멤버십 보존). **`[]`(빈 배열)** → 이 사용자의
    KEYCLOAK source 멤버십 전부 제거.
  - 그룹명 upsert — 없으면 `source=KEYCLOAK` 자동 생성. 단 **동명 LOCAL 그룹이 있으면
    스킵 + 경고 로그**(LOCAL→KEYCLOAK 전환·멤버 주입 금지).
  - 사용자의 **KEYCLOAK source 멤버십만** claim 집합과 정렬(추가/제거). **LOCAL 멤버십
    불가침**(수동 관리 유지). Keycloak 에서 그룹이 사라져도 DocSpace 그룹은 잔존(관리자
    수동 정리).
  - 멤버십 추가/제거는 단일 트랜잭션. **best-effort** — 동기화 예외가 로그인을 막지 않게
    try/catch 로 감싸 에러 로그만 남김.
- **infra(realm 시드 `infra/keycloak/realm-docspace.json`)**:
  - docspace-web `protocolMappers` 에 **group-membership 매퍼** 추가
    (`oidc-group-membership-mapper`, `claim.name=groups`, `full.path=false`,
    id/access/userinfo token claim 전부 true — L4 realm-role 매퍼 옆 동일 패턴).
  - 테스트 그룹 시드: `dev-team1`, `dev-team2`. `testuser` → dev-team1 배정.
  - **`testuser2` 사용자 시드 추가**(비번 `test1234`, temporary false, dev-team1) —
    런타임 생성 계정은 recreate 마다 소실되므로 시드로 영구화.
- **BE — claim 추출(`oidc.service`)**: `OidcClaims.groups?: string[]` 추가.
  `tokenSet.claims().groups` 에서 추출하며 경로형(`/dev-team1`)으로 와도 선행 `/` 를
  제거(full.path=false 라 보통 bare 이름). 미설정이면 undefined 유지 → 동기화 스킵.
- **BE — 동기화(`auth.service`)**: `findOrCreateOidcUser` 를 단일 tail 로 정리(계정
  해석 분기 후 한 곳에서 동기화·sanitize). 신규 private `syncKeycloakGroups(userId,
  groupNames)` — 그룹명 해석(LOCAL 동명 스킵, 미존재 KEYCLOAK 생성, 동시 로그인 경쟁
  시 재조회 복구) → 현재 KEYCLOAK 멤버십 조회(`group: { source: 'KEYCLOAK' }`) → 추가/
  제거 집합 계산 → 트랜잭션. `Logger` 추가(경고/에러).
- **테스트(+7, `auth.service.spec`)**: 신규 describe — undefined 스킵, 미존재 그룹
  KEYCLOAK 자동 생성+멤버십 추가, 추가+제거 동시 정렬, `[]` 전부 제거, 동명 LOCAL 스킵
  (생성·주입 안 함), 현재 멤버십 조회가 KEYCLOAK source 만(LOCAL 불가침), 동기화 예외에도
  로그인 성공(best-effort).
- **검증**: api `tsc` EXIT 0, `nest build` EXIT 0, jest **294 passed (26 suites)**
  (L7-2 287 + L8 7). 마이그레이션 없음(스키마 무변경 — 기존 Group/GroupMember/GroupSource
  재사용). realm JSON 은 node 파싱 + 매퍼/그룹/사용자 구조 확인 통과.
- **남은 일**:
  - L8 VM 검증: ① testuser2 SSO 로그인 → 그룹 탭에 dev-team1 이 KEYCLOAK 배지로 자동
    생성 + testuser2 멤버(편집 컨트롤 비활성), ② dev-team1 에 공간 편집자 부여 → testuser2
    편집 가능, ③ LOCAL 그룹(개발1팀) 멤버십은 로그인 후에도 그대로, ④ 로컬 로그인
    (localtest)은 그룹 변화 없음.
  - (Task L-AUTHZ 구현 종료 — 이후는 유지보수.)
- **비고**: ⚠️ **배포 2단계** — (1) api 변경 → VM 풀빌드(`./deploy/redeploy.sh`),
  (2) realm JSON 변경 → `sudo docker compose up -d --force-recreate keycloak`(일반
  `up -d` 로는 재import 안 됨). force-recreate 는 **런타임 Keycloak 계정을 초기화**하므로
  이번에 testuser2 를 시드로 영구화 — 이후 recreate 부터 안 사라짐. 기존 세션은 쿠키 삭제
  후 재로그인. L6 의 KEYCLOAK source 보호 가드(수정·삭제·멤버 편집 403)가 L8 동기화 그룹을
  관리자 오조작으로부터 보호 — 선반영이 그대로 적중.

---

## Cycle L9 — 2026-06-08 — ✅ Done (접근 권한 역산 API · effective-access)
- **제목**: Task L-AUTHZ 후속 — "이 공간/페이지 누가 볼 수 있지?" 역방향 조회 API
- **카테고리**: BE only / 인가 (마이그레이션 없음). 조회 화면 FE 는 L9-2 로 분리.
- **커밋**: `5e677b2`(코드), 본 CYCLES-ldh.md
- **배경**: 기존 권한은 "이 사용자가 이 자원에 접근되나?"(사용자→예/아니오) 방향뿐
  (canView/canEdit/loadAccess). 역방향 — "이 자원에 접근 가능한 사람 전부와 경로" — 가
  없어 관리자가 권한 감사("누가 볼 수 있지")를 할 수 없었다. L9 가 그 역산을 만든다.
- **엔드포인트(2)**:
  - `GET /spaces/:id/effective-access` — 공간 접근자 목록.
  - `GET /pages/:id/effective-access` — 페이지 접근자 목록(제한 반영).
  - 둘 다 게이트 = 공간 `canManage`(공간 ADMIN) 또는 전역 ADMIN. 그 외 403, 없는 자원 404.
  - limit/offset 페이지네이션(기본 50, 최대 200).
- **공간 역산 규칙**:
  - 개인 `SpaceMember` ∪ 공간 부여 그룹(`SpaceMemberGroup`) 멤버를 **사용자 단위로 합침**.
    같은 사용자가 개인+그룹이면 `via` 둘 다, `role` 은 max(판정과 동일 규칙).
  - 소유자(PERSONAL)는 `via: ['owner']`. 전역 ADMIN 은 개별 나열 대신 `globalAdmins:{count}`.
  - **PUBLIC 공간**은 전체 사용자 덤프를 피해 `{ everyone: true }` 플래그.
- **페이지 역산 규칙**:
  - `NONE`/`EDIT` → 보기 무제한이라 공간 결과와 동일(PUBLIC 은 everyone). 각 사용자에
    `pageRole`(EDIT/VIEW) 부여 — EDIT 모드는 작성자/공간관리자/제한 EDIT 멤버만 편집.
  - `VIEW_EDIT` → **공간 접근자 ∩ 제한 통과자**(개인 `PageRestriction` ∪ 그룹
    `PageRestrictionGroup`(L7-2) ∪ 작성자/공간관리자 우회). 항상 좁혀짐(everyone 불가).
    우회 경로는 `restrictionVia`(author/space-manager/personal/group)로 표기.
- **성능**: 그룹 멤버 **N+1 금지** — 관련 그룹 id 를 모아 `groupMember.findMany({groupId:{in}})`
  단일 조회 후 메모리 병합. 제한 그룹도 동일.
- **일관성**: `SpacePermissionService.maxSpaceRole` 공개해 판정과 같은 max 규칙 공유.
  effective-access 가 "접근됨"이라 목록의 사용자로 실제 `canView` 를 호출해도 참(단위
  테스트로 회귀 고정).
- **응답 스키마(예시)**:
  ```json
  // GET /spaces/:id/effective-access (PRIVATE)
  {
    "everyone": false,
    "users": [
      { "userId": "u1", "username": "kim", "name": "김개발", "department": "플랫폼",
        "role": "EDITOR",
        "via": ["personal", { "group": { "id": "g1", "name": "dev-team1" } }] }
    ],
    "total": 1, "limit": 50, "offset": 0,
    "globalAdmins": { "count": 2 }
  }
  // PUBLIC 공간: { "everyone": true, "globalAdmins": { "count": 2 } }
  // GET /pages/:id/effective-access (VIEW_EDIT) — users[] 항목에 추가:
  //   "pageRole": "VIEW", "restrictionVia": ["personal"]
  ```
- **테스트(+12, `effective-access.service.spec.ts`)**: 개인만 / 그룹만 / 개인+그룹 겹침
  (via 둘·max) / PERSONAL 소유자 / PUBLIC everyone / 비관리자 403 / 전역 ADMIN 별도 /
  NONE 동일 / 404 / VIEW_EDIT 좁힘(uOther 제외·작성자 우회·VIEW 멤버 보기만) / 그룹 제한
  멤버 포함(L7-2) / 일관성(목록 사용자 canView 참).
- **검증**: api `tsc` EXIT 0, `nest build` EXIT 0, jest **306 passed (27 suites)**
  (L8 294 + effective-access 12). 마이그레이션 없음(기존 스키마 재사용).
- **남은 일**:
  - L9 VM 검증(콘솔 fetch): admin 콘솔에서 비공개 공간 effective-access → 개인+그룹
    멤버가 via 와 함께, 페이지 제한(VIEW_EDIT) 건 페이지는 좁혀지는지, localtest 호출 시 403.
  - L9-2(접근 권한 조회 화면 FE) 구현.
- **비고**: BE 단독 사이클(FE L9-2 분리). 조회 전용 — 어떤 쓰기/판정도 바꾸지 않아
  기존 동작 영향 0. `EffectiveAccessService`/`EffectiveAccessModule`(spaces) 신설,
  spaces·pages 컨트롤러가 주입해 각자의 `:id/effective-access` 라우트 제공.

---

## Cycle L10 — 2026-06-08 — ✅ Done (부서 자동 권한 · department → 그룹 자동 배정)
- **제목**: Task L-AUTHZ 후속 — department 기준 그룹 자동 배정 + 공간 생성 기본 정책
- **카테고리**: BE only + infra(realm 시드) / 인가 (마이그레이션 1건). 매핑·일괄 화면 FE 는 L10-2.
- **커밋**: `7dc63fb`(코드), 본 CYCLES-ldh.md
- **배경**: 그룹(L6)·그룹 권한(L7/L7-2)·Keycloak 동기화(L8)는 됐으나 멤버십·공간 권한을
  admin 이 수동 연결해야 했다. 직원이 많으면 운영 불가. L10 은 department 기준 자동 배정으로
  admin 수작업을 0 에 가깝게. AFS 가 부서를 그룹으로 주면 L8 이, 속성(department)으로만
  주면 L10 이 폴백.
- **DB(마이그레이션 1건 `20260608000000_department_groups`)**:
  - `GroupSource` enum 에 `DEPARTMENT` 추가(수동 편집 잠금 대상).
  - `DepartmentGroupMapping`(@@map `department_group_mappings`): department(PK) → groupId,
    FK Cascade. 부서명↔그룹 표기 차이 등록(옵션). 매핑 없으면 동명 그룹 자동 처리.
  - 기존 Group/GroupMember/SpaceMemberGroup 무변경.
- **`DepartmentGroupService`(신규, `src/department/`)** — 부서 자동 배정 단일 출처:
  - `resolveOrCreateDepartmentGroup(부서명)`: 매핑 우선 → 동명 그룹 → 없으면 `source=DEPARTMENT`
    생성(동시 로그인 경쟁 시 재조회 복구). 빈 부서명이면 null.
  - `syncUserDepartmentGroup(userId, dept)`: 부서 없음(undefined/'') → 스킵(보존). 현 부서
    그룹이 DEPARTMENT 면 멤버십 보장(idempotent), 동명 LOCAL 이면 스킵+경고(불가침),
    KEYCLOAK 이면 L8 폴백으로 스킵. 현 부서가 아닌 DEPARTMENT 멤버십은 제거(부서 변경
    대응). LOCAL/KEYCLOAK 불가침. `AdminModule`↔`AuthModule` 순환을 피해 독립 모듈.
- **로그인 연동(`oidc.service`/`auth.service`)**:
  - `oidc.service`: `department` claim 추출(user-attribute 매퍼). 미설정이면 undefined → 스킵.
  - `findOrCreateOidcUser`: department claim 있으면 `User.department` 캐시 갱신(없으면 보존),
    신규 생성도 claim 값 사용. L8 그룹 동기화 **다음**에 `syncDepartmentGroupBestEffort`
    호출(우선순위: 그룹 claim 먼저, department 폴백). best-effort(실패해도 로그인 유지).
  - `localLogin`: 성공 시 동일하게 부서 그룹 동기화(부서 있으면).
- **공간 생성 기본 정책(`spaces.service.create`)**: `CreateSpaceDto.applyDepartmentDefault`
  (기본 true). true + 생성자 department 있으면 생성자 부서 그룹을 그 공간에 `SpaceMemberGroup`
  EDITOR 로 자동 부여(upsert, idempotent). 생성자는 기존대로 공간 ADMIN 멤버. department
  없으면 무동작. best-effort(부여 실패가 공간 생성을 무효화하지 않음).
- **L6 가드 확장(`groups.service.loadLocal`)**: KEYCLOAK 에 더해 **DEPARTMENT 도** 수동 편집
  잠금(`source !== 'LOCAL'` → 403). 둘 다 외부 출처가 멤버십을 관리하므로 손대면 다음
  로그인에 덮어쓰여진다.
- **infra(realm 시드)**: docspace-web 에 `department` user-attribute 매퍼
  (`oidc-usermodel-attribute-mapper`, user.attribute/claim.name `department`) + testuser/
  testuser2 에 `attributes.department = ["플랫폼"]`.
- **테스트(+15)**: `department-group.service.spec`(10) — 해석(매핑/동명/생성/빈값) + 동기화
  (undefined 스킵, DEPARTMENT 생성+멤버십+정리, LOCAL 스킵, KEYCLOAK 폴백 스킵, 변경 없음
  no-op). `spaces.service.spec`(3) — 공간 생성 부서 그룹 EDITOR 부여 / 옵션 off 무동작 /
  department 없음 무동작. `auth.service.spec`(2) — department claim → User.department 갱신 +
  부서 동기화 호출 / claim 없으면 department 키 없음(보존).
- **검증**: api `tsc` EXIT 0, `nest build` EXIT 0, jest **321 passed (28 suites)**
  (L9 306 + L10 15). realm JSON node 파싱+매퍼/속성 구조 확인. 마이그레이션은 `prisma generate`
  + `prisma validate`(valid 🚀) + SQL 정적 검증(로컬 Postgres 미가동 → `migrate deploy`
  미수행, VM 배포 시 자동 적용).
- **남은 일**:
  - L10 VM 검증: ① department 있는 계정(testuser2) SSO 로그인 → 그룹 탭에 부서 그룹이
    DEPARTMENT 배지로 자동 생성 + 멤버 자동 배정, ② 그 부서 그룹에 공간 권한 부여 → 부서원
    자동 접근, ③ 새 공간 생성(기본 옵션) → 생성자 부서 그룹 편집자 자동 등록, ④ LOCAL 영향 없음.
  - L10-2(부서↔그룹 매핑/일괄 매핑 화면 FE).
- **비고**: ⚠️ **배포 2단계** — (1) api 변경 → VM 풀빌드, (2) realm JSON 변경 →
  `sudo docker compose up -d --force-recreate keycloak`(일반 up -d 로는 재import 안 됨).
  force-recreate 는 런타임 Keycloak 계정을 초기화하나 testuser2 등은 시드로 영구(L8). 기존
  세션은 쿠키 삭제 후 재로그인. L8(그룹 claim)과 L10(department)은 source 가 달라 충돌 없음 —
  부서가 그룹으로도 오면 KEYCLOAK 이 이기고 L10 은 스킵.

---

## Cycle L10 followup — 2026-06-08 — ✅ Done (그룹 배지에 DEPARTMENT 유형 반영)
- **제목**: 관리자 그룹 탭 유형 배지의 DEPARTMENT 오표시 수정 (표시 버그)
- **카테고리**: FE only / 버그 수정 (마이그레이션·BE 무관)
- **커밋**: `7d26d0f`(코드), 본 CYCLES-ldh.md
- **증상(VM 피드백)**: L10 으로 부서 자동 그룹이 `source=DEPARTMENT` 로 저장·반환되는데,
  관리자 그룹 탭(AdminGroups)의 유형 배지가 LOCAL/KEYCLOAK 두 종류만 알아 DEPARTMENT
  그룹이 **"로컬" 로 잘못 표시**됐다. 데이터는 정상, 표시만 틀린 버그.
- **원인**: `SourceBadge` 와 편집 잠금 조건이 `source === "KEYCLOAK"`(isKc) 이분법으로
  하드코딩 — DEPARTMENT 를 인지하지 못해 else 분기("로컬")로 떨어짐.
- **해법(FE)**:
  - `SourceBadge` 를 3종 맵(로컬=초록 / Keycloak=파랑 / **부서=보라 "부서"**)으로 확장.
  - 편집 잠금을 `source !== "LOCAL"`(`managedNote()` 가 null 이 아님) 기준으로 일반화 →
    KEYCLOAK 처럼 **DEPARTMENT 도 삭제·멤버 추가/제거 비활성** + 안내 문구(부서 자동 관리).
    BE 는 L10 의 `loadLocal` 가드로 이미 403 차단(FE 잠금은 UX 일치).
  - `SpaceMemberGroupsPanel` 의 source union·표기에 DEPARTMENT 추가(그룹 선택 드롭다운
    " (부서)" 접미 + 목록 "부서" 태그) — 다른 화면도 안 깨지게 점검.
- **검증**: web `tsc --noEmit` EXIT 0. (FE 변경, 마이그레이션·BE 무관 → api 회귀 없음.)
- **남은 일**: L10 VM 재확인 — 그룹 탭에서 "플랫폼" 배지가 DEPARTMENT("부서")로 표시 +
  멤버 편집 컨트롤 비활성. (L10 본 사이클 VM 시나리오 ①에 흡수.)
- **비고**: FE 만 변경 → 배포는 VM 풀빌드(마이그레이션 없음). 데이터/판정은 무변경이라
  순수 표시 정합성 수정.

---

## Cycle L-API-1 — 2026-06-09 — ✅ Done (프로그램 접근용 API 토큰, BE)
- **제목**: 프로그램/외부 시스템/MCP 서버용 장수명 API 토큰 발급/검증/폐기 (Task L-API 1단계)
- **카테고리**: BE / 인증(하이브리드) / 마이그레이션 1건
- **커밋**: `7586b66`(코드), 본 CYCLES-ldh.md
- **배경**: 리더 요청 — 프로그램/외부 시스템/MCP 서버가 사람 세션(쿠키) 없이 DocSpace 를
  호출하려면 장수명 토큰이 필요. 향후 MCP 서버 인증 수단의 선행조건. 권한은 토큰 주인의
  권한(L5~L10)을 그대로 승계 → 별도 권한 설계 불필요.
- **DB(마이그레이션 `20260609000000_api_tokens`)**: `ApiToken { id, userId(FK Cascade),
  name, tokenHash(unique), tokenPrefix, expiresAt?, lastUsedAt?, revokedAt?, createdAt }`.
  인덱스 tokenHash(unique)/userId. **평문 미저장 — sha256 해시만**.
- **발급·검증(ApiTokenService)**:
  - 발급 = `dsp_` + 암호학적 난수 32바이트 base64url. 평문은 **발급 응답에만 1회**(재조회
    불가). 저장은 sha256 해시 + tokenPrefix(앞 12자, 표시용).
  - 검증(`authenticateToken`) = Bearer 평문 → sha256 → 조회 → revokedAt null + 미만료 →
    발급자 `findById`(쿠키 인증과 동일 AuthUser) → isActive 확인. 미존재/폐기/만료/비활성은
    구분 없이 `null`(정보 노출 최소화).
  - `lastUsedAt` 은 **1분 throttle**(마지막 갱신이 60초 초과일 때만 update) — 매 요청
    write 부담 회피. 갱신 실패는 best-effort(인증 막지 않음).
- **하이브리드 인증(가드 확장, 라우트 무변경)**: `ApiTokenStrategy`(passport `'api-token'`)
  등록 + `JwtAuthGuard`/`OptionalJwtAuthGuard` 를 `AuthGuard(['jwt','api-token'])` 로 확장.
  passport 가 순서대로 시도 → 쿠키 있으면 jwt, Bearer 만 있으면 api-token. 토큰 인증 후
  `req.user` 가 쿠키와 **동일 형태** → 기존 RolesGuard/SpacePermissionService(L5~L10) 그대로
  동작. Optional 경로(GET /spaces 등)는 쿠키/토큰/둘 다 없음(익명) 세 경우 종전 의미 유지.
- **관리 API**:
  - 본인(쿠키 전용 `CookieAuthGuard`): `POST /auth/tokens { name, expiresInDays? }` →
    `{ id, name, token(평문 1회), tokenPrefix, expiresAt, createdAt }`. `GET /auth/tokens`
    (평문 없음). `DELETE /auth/tokens/:id`(즉시 무효, 남의 것 404, idempotent).
  - admin(`CookieAuthGuard`+`RolesGuard` ADMIN): `GET /admin/api-tokens`(전체, 소유자 동반),
    `DELETE /admin/api-tokens/:id`(강제 폐기).
  - **토큰 관리 라우트는 쿠키 전용** — 유출 토큰이 스스로 새 토큰을 발급/폐기하지 못하게
    차단(자기증식 방지). 데이터 라우트만 하이브리드.
- **보안**: 평문은 발급 응답 외 어디에도 노출 안 함(목록/에러/로그 포함). 비교는 해시로만.
  `dsp_` 접두 아닌 입력은 DB 조회조차 안 함.
- **테스트(+23 → 343 통과, 30 suites)**: `api-token.service.spec`(18) — 평문 미저장·해시
  일치·prefix, 무기한/만료, 본인/admin 폐기·404·idempotent, 인증(유효/접두불일치/미존재/폐기/
  만료/비활성/throttle 생략·갱신). `api-token.strategy.spec`(5) — 헤더없음/비-Bearer fail,
  유효 success, null fail, 내부오류 error.
- **검증**: api `tsc --noEmit` EXIT 0, `nest build` EXIT 0, jest **343 passed (30 suites)**
  (L10 321 + 본 사이클 22 + …). 마이그레이션은 `prisma generate` + `prisma validate`(valid 🚀)
  + SQL 정적 검증(로컬 Postgres 미가동 ECONNREFUSED → `migrate deploy` 미수행, VM 배포 시 자동 적용).
- **발급/검증 흐름**:
  1. `POST /api/auth/tokens`(쿠키) → 평문 1회 수령.
  2. 프로그램이 `Authorization: Bearer dsp_...` 로 보호 API 호출 → api-token 전략이 해시
     조회·검증 → 주인 권한으로 처리.
  3. `DELETE /api/auth/tokens/:id` → revokedAt 설정 → 같은 토큰 호출 즉시 401.
- **응답 스키마(발급)**:
  `{ "id": "ck...", "name": "CI 봇", "token": "dsp_xxxxxxxx...", "tokenPrefix": "dsp_xxxxxxxx", "expiresAt": null, "createdAt": "2026-06-09T..." }`
- **남은 일**:
  - **L-API-1 VM 검증**(콘솔/curl): ① `POST /api/auth/tokens` 발급 → 평문 1회 확인,
    ② 그 토큰 Bearer 헤더로 `GET /api/spaces`(쿠키 없이) → 성공(본인 공간 반환),
    ③ `DELETE` 폐기 후 같은 호출 → 401, ④ `GET /api/auth/tokens` 목록에 평문 없이
    prefix/만료/lastUsed 표시, ⑤ admin `GET/DELETE /api/admin/api-tokens` 강제 폐기.
  - L-API-2(토큰 발급/관리 화면 FE).
  - (후속) 토큰 스코프(권한 축소), MCP 서버 인증 연동.
- **비고**: 배포는 **마이그레이션 포함 → VM 풀빌드**(`--no-build` 금지). 기존 쿠키 인증은
  멀티 전략 전환 후에도 동작 100% 동일(토큰 없이 쿠키로 오는 요청은 jwt 전략이 종전대로).
  토큰=주인 권한 승계라 별도 인가 설계 없음 — 스코프는 후속.

---

## Cycle L-API-3 — 2026-06-09 — ✅ Done (API 토큰 스코프 READ / READ_WRITE, BE)
- **제목**: API 토큰 최소권한 스코프(2단계) — READ(읽기 전용) / READ_WRITE(전체) (Task L-API 후속)
- **카테고리**: BE / 인증·인가(토큰) / 마이그레이션 1건
- **커밋**: `3e8f280`(코드), 본 CYCLES-ldh.md
- **배경**: L-API-1 토큰은 발급자 전권(read-write). 외부/MCP 에 줄 때 최소권한으로 좁히도록
  토큰별 스코프 도입. 리소스별 세분화는 미도입(2단계만).
- **확정 설계**:
  - 2단계: READ(GET·HEAD 만) / READ_WRITE(전체). 발급 시 선택, **기본 READ_WRITE**(기존
    동작 유지 — 기존 레코드 READ_WRITE 백필).
  - 결합: 스코프 = 주인 권한 위 **상한선 = min(주인 권한, 스코프)**. 넓히지 않고 좁히기만.
    쿠키 세션 인증은 스코프 무관(토큰 인증에만 적용).
  - 쓰기 차단은 **403**(인증은 유효, 401 아님) → 전역 401 자동 로그아웃에 안 걸림.
- **DB(마이그레이션 `20260609010000_api_token_scope`)**: `ApiTokenScope` enum
  { READ, READ_WRITE } + `ApiToken.scope @default(READ_WRITE)`. 기존 토큰은 DEFAULT 로
  백필 → 종전 동작 100% 보존.
- **발급 API**: `POST /auth/tokens` body 에 `scope?`('READ'|'READ_WRITE', 생략 시 서비스가
  READ_WRITE). 발급/목록/admin 응답에 `scope` 포함. DTO `@IsIn([READ, READ_WRITE])`.
- **enforcement(토큰 인증 경로에만, 라우트 무변경)**:
  - `ApiTokenStrategy` 인증 성공 시 `req.authVia='api-token'` + `req.tokenScope=scope` 표시
    (`authenticateToken` 이 `{ user, scope }` 반환).
  - 전역 `ApiTokenScopeInterceptor`(APP_INTERCEPTOR, AuthModule 등록)가 판정: `authVia===
    'api-token'` && `tokenScope==='READ'` && 메서드가 GET/HEAD 아니면 403.
  - **왜 인터셉터인가**: 가드 실행 순서(전역 가드→컨트롤러→라우트)상 전역 *가드*는 라우트
    JwtAuthGuard 보다 **먼저** 돌아 req 표식이 아직 없다. *인터셉터*는 모든 가드 **이후**
    실행 → 토큰 전략이 심은 표식을 안전하게 읽는다. 라우트엔 손 안 댄다.
  - 쿠키 인증(authVia 없음/'cookie')·public 라우트엔 표식이 없어 **no-op** → 스코프 영향 0.
    READ_WRITE 토큰도 통과(쓰기 권한은 결국 주인 권한 가드가 최종 판정 — 스코프가 권한
    안 넓힘).
- **기존 동작 보존**: 기존 토큰 READ_WRITE 백필, 멀티 전략·쿠키 경로 무변경 → 쿠키
  사용자·기존 토큰 영향 0.
- **테스트(+12 → 355 통과, 31 suites)**: `api-token.service.spec` — scope 미지정→READ_WRITE,
  scope=READ 저장·노출, 인증 결과 `{ user, scope }`. `api-token.strategy.spec` — 유효 토큰
  성공 시 req.authVia/tokenScope 표시. `api-token-scope.interceptor.spec`(신규 10) — READ
  GET/HEAD 통과·POST/PUT/PATCH/DELETE 403, READ_WRITE 쓰기 통과, 쿠키(authVia 없음/cookie)
  통과, non-http no-op.
- **검증**: api `tsc --noEmit` EXIT 0, `nest build` EXIT 0, jest **355 passed (31 suites)**
  (L-API-1 343 + 본 사이클 12). 마이그레이션 `prisma generate` + `prisma validate`(valid 🚀)
  + SQL 정적 검증(로컬 Postgres 미가동 ECONNREFUSED → `migrate deploy` 미수행, VM 배포 시
  자동 적용).
- **응답 스키마(발급)**:
  `{ "id": "ck...", "name": "읽기봇", "token": "dsp_...(평문 1회)", "tokenPrefix": "dsp_xxxxxxxx", "scope": "READ", "expiresAt": null, "createdAt": "2026-06-09T..." }`
- **남은 일**:
  - **L-API-3 VM 검증**(콘솔, `credentials:'omit'` + `cache:'no-store'`, 인증필수 `/auth/me`):
    ① READ 토큰 Bearer → `GET /api/auth/me` 200, ② 같은 READ 토큰으로 쓰기(POST 계열) →
    403, ③ READ_WRITE 토큰으로 같은 쓰기 → 정상. ※쓰기 차단은 403이라 자동 로그아웃 안 됨.
  - L-API-2(토큰 발급/관리 화면 FE) — 발급 폼에 scope 선택 + 목록에 scope 배지 반영 필요.
  - (후속) 리소스별 세분화 스코프, MCP 서버 인증 연동.
- **비고**: 배포는 **마이그레이션 포함 → VM 풀빌드**(`--no-build` 금지). 전역 인터셉터는
  스코프 enforcement 전용·토큰 경로에만 작동하는 additive 추가라 기존 라우트/가드 무영향.

---

## Cycle L-API-4 — 2026-06-09 — ✅ Done (OpenAPI(Swagger) 명세 + MCP 연동 가이드, BE+문서)
- **제목**: OpenAPI(Swagger) 기계가독 명세 + `docs/MCP-INTEGRATION.md` (사내 MCP 개발 지원)
- **카테고리**: BE(데코레이터·부트스트랩) + 문서 / 마이그레이션 없음
- **커밋**: `9b87b3b`(코드), 본 CYCLES-ldh.md + docs/MCP-INTEGRATION.md
- **배경**: 사내 팀이 DocSpace 용 MCP 서버 개발 예정. 받아주는 쪽(토큰 L-API-1, 스코프
  L-API-3, 기존 REST)은 갖췄으니, 그 팀이 보고 만들 **기계가독 명세(OpenAPI)** + 토큰 가이드 제공.
- **OpenAPI(Swagger)**:
  - `@nestjs/swagger`(11.4.4) 도입. `main.ts` 에서 `DocumentBuilder` + `SwaggerModule.setup`
    으로 `api/docs`(UI) + `api/docs-json`(raw OpenAPI JSON) 노출. `addBearerAuth({type:http,
    scheme:bearer}, 'api-token')` 로 Bearer 스킴 등록 → Authorize 에 dsp_ 토큰 넣고 바로 호출.
  - **⚠️ 노출 게이트(보고)**: `process.env.NODE_ENV !== 'production'` 일 때만 `setup` 호출.
    운영에선 **라우트 자체가 등록되지 않아** /api/docs·/api/docs-json 이 404 → 명세 유출·
    표면 확대 없음. (env 기반 + 핸들러 미등록 = 가장 단순·확실한 차단.)
  - **경로 결정**: API 는 `setGlobalPrefix` 없는 bare 라우팅(웹이 `/api/* → api/*` 프록시).
    Swagger 를 NestJS `api/docs`/`api/docs-json` 에 직접 올려 **API 서버 직접 접속 시 경로가
    그대로 `/api/docs`, `/api/docs-json`** 이 되게 했다(UI 의 spec fetch 도 동일 오리진에서
    정상). MCP 가 실제로 쓰는 건 raw JSON(`/api/docs-json`) — 단일 GET 이라 프록시로도 무난.
- **데코레이터(전체 아님, 연동 핵심만)**:
  - `auth`: `GET /auth/me`(@ApiBearerAuth, 토큰/쿠키 스모크용) + `auth-tokens`: `POST
    /auth/tokens`(쿠키 전용·평문 1회·scope 설명).
  - `spaces`: 목록. `pages`: 목록 / `full-search`(@ApiQuery q·limit·offset) / 단건 / 생성.
  - 클래스 레벨 `@ApiTags` + 데이터 컨트롤러엔 `@ApiBearerAuth('api-token')`. 본문(content)
    = ProseMirror JSON 주석 명시.
  - 데코레이터는 **런타임 불변** — 가드/핸들러/권한 동작에 영향 0(기존 355 회귀 안전).
- **문서(`docs/MCP-INTEGRATION.md` 신규)**: 인증(토큰 발급 쿠키 필요·평문 1회·Bearer 호출),
  스코프(READ 쓰기 403 / READ_WRITE, 읽기 도구엔 READ 권장), 권한(토큰=발급자 권한 승계 →
  MCP 전용 계정+적정 권한 권장), 핵심 엔드포인트 표(검색/페이지/스페이스), ⚠️ 본문 ProseMirror
  JSON(텍스트로 다루려면 변환 필요, 이번엔 변환 엔드포인트 미제공), 명세 위치(비프로덕션
  /api/docs·/api/docs-json).
- **검증**: api `tsc --noEmit` EXIT 0, `nest build` EXIT 0, jest **355 passed (31 suites)**
  (회귀 0 — 데코레이터 런타임 불변). 마이그레이션 없음. Bearer 스킴 생성은 `DocumentBuilder`
  단독 실행으로 확인(`securitySchemes.api-token = {scheme:bearer, type:http}`). **런타임
  /api/docs(-json) 덤프는 부트 시 Prisma `$connect` 필요 → 로컬 Postgres 미가동으로 미수행**,
  VM(DB 가동)에서 확인.
- **남은 일**:
  - **L-API-4 VM 검증**(비프로덕션): ① `GET /api/docs` → 엔드포인트 목록 + Authorize(Bearer)
    로 dsp_ 토큰 넣고 호출, ② `GET /api/docs-json` → OpenAPI JSON(보안 스킴 api-token·태그
    auth/spaces/pages 포함), ③ `NODE_ENV=production` 부팅 시 두 경로 404 확인.
  - (후속) **미니 MCP 스모크 테스트**: docs-json 으로 실제 MCP 서버 1개 띄워 검색/조회 왕복.
    필요 시 ProseMirror→텍스트 변환 엔드포인트 검토.
  - L-API-2(토큰 발급/관리 화면 FE).
- **비고**: 배포는 VM 풀빌드(마이그레이션 없음). 운영 노출 차단은 `NODE_ENV=production` 전제 —
  VM/운영 env 에 NODE_ENV=production 설정돼 있어야 게이트가 닫힌다(배포 env 점검 권장).

---

## Cycle L-API-4 fix — 2026-06-09 — ✅ Done (api 컨테이너 부팅 실패 수정: platform-express)
- **제목**: L-API-4 배포 후 api 재시작 루프 수정 — `@nestjs/platform-express` 미설치
- **카테고리**: BE(의존성/배포) / 마이그레이션 없음
- **커밋**: `1d9d744`(코드: package.json + package-lock.json), 본 CYCLES-ldh.md
- **증상**: L-API-4(@nestjs/swagger 도입) 배포 후 api 컨테이너 재시작 루프. 로그:
  `No driver (HTTP) has been selected ... install @nestjs/platform-express`. Nest 가 HTTP
  어댑터를 못 잡아 부팅 실패.
- **원인**: L-API-4 의 `npm install @nestjs/swagger -w apps/api` 가 의존성 트리를 재배치하며
  `@nestjs/platform-express` 를 **루트 hoist(resolved+integrity 있음)에서 떼어내
  `apps/api/node_modules` 하위 항목으로 옮기고, 그 lockfile 항목에 `resolved`/`integrity`
  를 누락**시켰다. 컨테이너 빌드는 `npm ci`(Dockerfile L38) — resolved 누락 항목은 **에러
  없이 설치를 건너뛴다**. 그 결과 빌드는 성공해도 platform-express 실파일이 루트·api 어느
  node_modules 에도 안 깔려, 런타임 `require` 실패 → "No HTTP driver" → 부팅 루프.
  (swagger 가 platform-express 를 요구하지만 의존성에 *명시*돼 있어도 lockfile 항목이
  깨져 있으면 npm ci 가 안 깐다 — 핵심은 lockfile 무결성.)
- **해법**: 루트에서 `npm install @nestjs/platform-express@^11 -w apps/api` 재설치 →
  platform-express 가 **루트 node_modules 로 다시 hoist + `resolved`/`integrity` 복구**
  (11.1.26, core/common 메이저와 일치). package.json range `^11.0.1`→`^11.1.26`,
  package-lock 갱신. 이제 npm ci 가 정상 설치 → 런타임 `COPY --from=build /app/node_modules`
  (Dockerfile L58)로 포함 → 부팅 성공.
- **lockfile 점검**: 수정 전 lockfile 에 `resolved/integrity` 누락 항목 630개(거의 전부
  `apps/api/node_modules/*` 하위 — 사내 프록시/CA 환경 생성물, 종전 배포는 정상)였고,
  본 수정으로 563개로 **감소**(새 손상 유입 없음, platform-express 항목은 완치). 나머지는
  종전부터 빌드되던 build-time devDep 들이라 미손대(불필요 churn·web 의존성 영향 회피).
- **검증**: api `tsc --noEmit` EXIT 0, `nest build` EXIT 0, jest **355 passed (31 suites)**
  (회귀 0). **web `npm run build` 성공**(react 18.3.1 / next 14.2.35 무손상 — workspace
  hoist 부작용 없음 확인). 마이그레이션 없음. 런타임 부팅은 VM 확인 대기(패키지 의존·
  lockfile 무결성까지 점검 완료).
- **남은 일**:
  - **VM 배포 검증**: VM 풀빌드(새 의존성 포함) 후 `docker compose ps` 로 api **Up**(재시작
    루프 해소) 확인 → 이어서 L-API-4 VM 검증(① /api/docs ② /api/docs-json ③ prod 404) 진행.
- **비고**: 배포는 **VM 풀빌드 필수**(새 의존성 — `--no-build`/`--no-deps` 금지). 교훈:
  workspace 에 패키지 추가 시 lockfile 의 해당 항목에 `resolved`/`integrity` 가 박혔는지
  확인할 것(누락 시 npm ci 가 조용히 스킵 → 런타임에서야 터진다).
