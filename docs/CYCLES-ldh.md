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
- **남은 일**: ① LOCAL_LOGIN_ENABLED=true 환경 실제 로그인/SSO전용 거부 브라우저
  확인(VM), ② L2(관리자 로컬 계정 생성·활성/비활성), ③ L3(비번 정책·실패 잠금·
  셀프 비번 변경). 관리자 비번 설정은 엔드포인트만 — 화면 UI 는 후속.
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
- **남은 일**: ① LOCAL_LOGIN_ENABLED=true 환경 브라우저 확인(계정 생성→로컬 로그인,
  비활성화→로컬·OIDC·기존 세션 거부, 자기 자신 비활성화 거부), ② L3(비번 정책·실패
  잠금 failedLoginCount/lockedUntil·셀프 비번 변경).
- **비고**: L1 남은 일 '관리자 비번 설정 UI' **닫힘**(AdminUsers 비번 설정/초기화
  다이얼로그로 마감). 계정 유형 배지는 hasLocalPassword/isSso 조합으로 SSO/로컬/혼합
  3종 표기. isActive 는 AuthUser 에 포함돼 /auth/me·jwt 검증 양쪽에서 사용. 마이그레이션은
  ADD COLUMN NOT NULL DEFAULT true 단일 구문 — 무중단·테이블 재작성 없음.
