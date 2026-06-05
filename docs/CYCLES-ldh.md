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
