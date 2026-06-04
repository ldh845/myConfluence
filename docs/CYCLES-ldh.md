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
