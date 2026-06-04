# DocSpace — Task 현황 (feature/ldh 전용)

> feature/ldh 브랜치 전용 Task 현황. 공통 docs/TASKS.md 와 별개로
> ldh 작업분을 관리한다.

---

## Task L-AUTH — 하이브리드 인증 (SSO + 로컬 로그인)

- **범위**: 기존 OIDC 단일 로그인(Cycle 43)을 SSO + 로컬 로그인 병행으로
  확장. 별도 테이블 없이 기존 `User.passwordHash`(nullable)·
  `keycloakId`(nullable)를 재활용한다. 로컬 로그인은 환경변수 플래그
  `LOCAL_LOGIN_ENABLED` 로 on/off.
- **상태**: 🟢 Active (L1 ✅ Done, L2 ✅ Done, L3 📝 Planned)
- **하위 사이클**:
  - **L1** — 로컬 로그인 BE(`POST /auth/login`, bcrypt → 기존 `issueToken`/
    `docspace_session` 재사용) + 로그인 화면 ID/PW 폼 + 관리자 '로컬 비번
    설정/초기화' 최소 기능 + `LOCAL_LOGIN_ENABLED` 플래그. ✅ Done
  - **L2** — 관리자 로컬 계정 생성·활성/비활성(퇴사자 대응). ✅ Done
  - **L3** — 비번 정책·로그인 실패 잠금(`failedLoginCount`/`lockedUntil`)·
    셀프 비번 변경. 📝 Planned
- **진척**:
  - **Cycle L1 (2026-06-02) ✅** — 로컬 로그인 BE(`POST /auth/login`, 플래그
    게이트, bcrypt → `docspace_session` 재사용)·`GET /auth/local-login-enabled`·
    관리자 `PATCH /admin/users/:id/local-password`·로그인 화면 ID/PW 폼 완성.
    bcrypt 의존성 복원, 마이그레이션 불필요. api/web tsc·nest build EXIT 0,
    jest 158 passed. 상세는 `docs/CYCLES-ldh.md` Cycle L1.
  - **Cycle L2 (2026-06-04) ✅** — `User.isActive` 추가(마이그레이션 1건)·로컬 계정
    생성(`POST /admin/users`, 중복 409)·활성 토글(`PATCH /admin/users/:id/active`,
    자기 자신 비활성화 400)·로그인 차단 3곳(로컬/OIDC/jwt 세션)·관리자 화면(생성·유형
    배지·토글·비번 설정). L1 남은 일 '관리자 비번 설정 UI' 닫힘. api/web tsc·nest
    build EXIT 0, jest 167 passed. 상세는 `docs/CYCLES-ldh.md` Cycle L2.
  - **Cycle L2 followup (2026-06-04) ✅** — 2026-06-04 VM 검증 완료(계정 생성/로컬
    로그인/비활성 거부/셀프 락아웃 정상). 단, 비활성 사용자 기존 세션의 캐시 화면 잔상
    발견 → 전역 401 핸들러(`POST /auth/clear-session` + `window.fetch` 패치 추방 →
    `/login?error=session_expired`)로 수정. 마이그레이션 없음. jest 171 passed.
    상세는 `docs/CYCLES-ldh.md` L2 followup.
  - **Cycle L2 followup 2 (2026-06-04) ✅** — 추방 후 뒤로가기 시 bfcache 복원 잔상
    차단. `window 'pageshow'` 의 `event.persisted` 에서 `/api/auth/me` 재검증 → 죽었으면
    기존 추방 흐름 그대로 재사용. web tsc EXIT 0, api jest 171 passed 회귀 없음.
    상세는 `docs/CYCLES-ldh.md` L2 followup 2.
  - **Cycle L2 followup 3 (2026-06-04) ✅** — 뒤로가기 연타 잔상 근본 차단. 보호 라우트
    응답에 `Cache-Control: no-store`(middleware) + 추방 시 `location.replace`(히스토리
    미적재). 기존 가드는 이중 방어로 유지. web tsc EXIT 0, api jest 171 passed 회귀 없음.
    상세는 `docs/CYCLES-ldh.md` L2 followup 3.
- **남은 일**: L3 — 비번 정책·로그인 실패 잠금(`failedLoginCount`/`lockedUntil`)·
  셀프 비번 변경.
