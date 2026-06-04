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
- **남은 일**: L2 브라우저 확인(VM, LOCAL_LOGIN_ENABLED=true — 계정 생성→로컬 로그인,
  비활성화→로컬·OIDC·기존 세션 거부, 자기 자신 비활성화 거부), L3 착수.
