# DocSpace — Task 현황 (feature/ldh 전용)

> feature/ldh 브랜치 전용 Task 현황. 공통 docs/TASKS.md 와 별개로
> ldh 작업분을 관리한다.

---

## Task L-AUTH — 하이브리드 인증 (SSO + 로컬 로그인)

- **범위**: 기존 OIDC 단일 로그인(Cycle 43)을 SSO + 로컬 로그인 병행으로
  확장하고, 로컬 전용 계정의 운영(생성·활성/비활성·역할)을 DocSpace 에서
  직접 수행한다. 별도 테이블 없이 기존 `User.passwordHash`(nullable)·
  `keycloakId`(nullable)·`role` 을 재활용한다. 로컬 로그인은 환경변수 플래그
  `LOCAL_LOGIN_ENABLED` 로 on/off.
- **상태**: 🟡 Maintenance (L1·L2·L3 검증 완료, L4 코드 완료 — L4 VM 검증만 대기)
- **하위 사이클**:
  - **L1** — 로컬 로그인 BE(`POST /auth/login`, bcrypt → 기존 `issueToken`/
    `docspace_session` 재사용) + 로그인 화면 ID/PW 폼 + 관리자 '로컬 비번
    설정/초기화' 최소 기능 + `LOCAL_LOGIN_ENABLED` 플래그. ✅ Done
  - **L2** — 관리자 로컬 계정 생성·활성/비활성(퇴사자 대응). ✅ Done
  - **L3** — 비번 정책·로그인 실패 잠금(`failedLoginCount`/`lockedUntil`)·
    셀프 비번 변경. ✅ Done
  - **L4** — 계정 역할 관리(로컬 전용 계정 ADMIN/DEVELOPER 변경, SSO 는 Keycloak
    관리로 안내). ✅ Done
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
  - **Cycle L3 (2026-06-04) ✅** — 비번 정책(8자+영문+숫자, 단일 출처)·로그인 실패
    잠금(5회/15분, 423 + 관리자 unlock)·셀프 비번 변경(`PATCH /auth/me/password`).
    마이그레이션 1건(failedLoginCount/lockedUntil). api/web tsc·nest build EXIT 0,
    jest 191 passed(18 suites). 상세는 `docs/CYCLES-ldh.md` Cycle L3.
  - **Cycle L4 (2026-06-05) ✅** — 로컬 전용 계정 역할 변경(`PATCH /admin/users/:id/role`,
    ADMIN/DEVELOPER)·SSO/혼합·자기 자신 거부(400)·역할 변경 즉시 반영(jwt.strategy 가
    DB role 사용 — 재로그인 불필요)·관리자 화면 역할 셀 인터랙티브화(로컬만 select, SSO 는
    Keycloak 안내). 마이그레이션 없음. api/web tsc·nest build EXIT 0, jest 196 passed.
    상세는 `docs/CYCLES-ldh.md` Cycle L4.
  - **Cycle L4 followup (2026-06-05) ✅** — API 응답 캐시 금지. 권한/세션(`/auth/me` 등)
    응답이 브라우저 디스크 캐시에 남아 역할 변경 즉시 반영이 최초 1회 안 먹던 증상 →
    전역 미들웨어로 `Cache-Control: no-store` 부착(파일 다운로드 2경로 제외). api만 변경,
    마이그레이션 없음. api tsc·nest build EXIT 0, jest 201 passed(19 suites).
    상세는 `docs/CYCLES-ldh.md` Cycle L4 followup.
- **남은 일**: L4 followup VM 검증만 —
  - ⑩ 역할 변경이 재로그인 없이 **최초부터** 즉시 반영되는지,
  - ⑪ `/api/auth/me` 응답 헤더 `Cache-Control: no-store` 확인,
  - ⑫ 본문 이미지 페이지 새로고침 시 이미지 캐시 로드(성능 저하 없음) 확인.
  - (L4 감사 로그(역할 변경 이력)는 ActivityLog 페이지/공간 중심 한계로 deferred.)
- **검증 완료(VM)**:
  - L1·L2(2026-06-04)·L3(2026-06-04~05) — 약한 비번 거부 / 5회 오답 잠김 / admin 잠금
    해제 / 셀프 비번 변경 / 순수 SSO 계정(admin·testuser2) 변경 메뉴 미노출 + 계정 유형
    3종(로컬·혼합·SSO) 메뉴 노출 매트릭스까지 전부 확인.
  - L4(2026-06-05) ⑥~⑨ — 승격 시 톱니바퀴 노출 / 강등 시 사라짐 / SSO·혼합 행 역할 컨트롤
    비활성 + Keycloak 안내 / 자기 자신 행 비활성까지 전부 합격. 단 ⑥ 검증 중 "역할 변경
    즉시 반영이 최초 1회 미동작(재로그인 후 일관 동작)"을 발견 → 이것이 L4 followup 의 동기.

---

## Task L-AUTHZ — 권한 체계 보강·그룹 기반 권한

- **범위**: 기존 3계층 권한(전역 role(48) / 스페이스 멤버십·공개범위(74-A) /
  페이지 제한(83))의 enforcement 빈틈을 닫고, 개인 단위뿐인 권한 부여를
  그룹(부서/팀) 단위로 확장한다.
- **상태**: 🟢 Active (L5·L5-2 ✅ — enforcement 빈틈 전부 폐쇄, 다음은 L6 그룹 권한)
- **하위 사이클**:
  - **L5** — 권한 가드 구멍 보강: 무인증 쓰기(🔴4) + 데이터 누수 읽기(🟠10) 폐쇄
    + `assertCanViewPage` 프리미티브. ✅ Done
  - **L5-2** — 인증됐으나 공간/페이지 권한 미검사 쓰기(🟡13: 댓글 작성/수정/삭제·resolve,
    리액션 toggle, watch, page-share 발급/회전/취소, 페이지 상태 변경, setHomePage) 보강.
    확정 정책 12항목 적용. ✅ Done
  - **L6** — 그룹 모델 + 관리자 그룹 관리(생성·멤버). 📝 Planned
  - **L7** — 스페이스 권한·페이지 제한에 그룹 적용. 📝 Planned
  - **L8** — Keycloak 그룹 동기화. 📝 Planned
- **진척**:
  - **Cycle L5 (2026-06-05) ✅** — apps/api 전수 인벤토리(18 컨트롤러 ~70 라우트) 후
    보안 핵심 14곳 폐쇄: 무가드 쓰기(첨부 업로드/삭제, 다이어그램 수정/삭제) +
    무가드/무권한 읽기 누수(첨부 목록·다운로드, 다이어그램 조회, 페이지 다이어그램·버전
    목록, 휴지통, 댓글·리액션 목록, 활동 피드) + `POST /spaces` 비인증 생성 차단.
    신규 프리미티브 `assertCanViewPage`. 마이그레이션 없음. api tsc·nest build EXIT 0,
    jest 221 passed(21 suites). 상세·인벤토리 표는 `docs/CYCLES-ldh.md` Cycle L5.
  - **Cycle L5-2 (2026-06-05) ✅** — 🟡 13개 쓰기 경로에 확정 정책 적용: 댓글 작성=읽기
    권한, 수정=본인만(관리자도 불가), 삭제=본인 OR 공간관리, resolve/unresolve·page-share
    3종·상태변경=편집 권한, 리액션 toggle·watch=읽기 권한, setHomePage=공간관리. 기존
    프리미티브 재사용, 마이그레이션 없음. api tsc·nest build EXIT 0, jest 245 passed(25 suites).
    상세·정책 표는 `docs/CYCLES-ldh.md` Cycle L5-2.
- **남은 일**:
  - L5-2 VM 검증(적용 정책 기준) — 아래 시나리오 ⑦~⑬.
  - L6~L8(그룹 권한) 설계.
- **검증 완료(VM)**:
  - **L5(2026-06-05)** — ④⑥ UI 확인(비멤버의 활동 피드·휴지통에 비공개 항목 미노출 +
    PUBLIC 공간 기존 흐름 회귀 없음), ①⑤ 콘솔 fetch 로 403 확인(비공개 페이지 댓글 목록·
    버전 이력·첨부 업로드). ②③ 은 동일 프리미티브(assertCanViewPage/EditPage) 재사용
    경로 + 단위 테스트 커버를 근거로 검증 생략 결정. → L5 시나리오 ①~⑥ 종결.
- **L5-2 VM 검증 시나리오**:
  - ⑦ 뷰어(읽기 권한만)가 공개 공간 페이지에 댓글 작성 → OK / 비공개 비멤버는 403.
  - ⑧ 남의 댓글 수정 → 403(공간 관리자·전역 ADMIN 으로도 403), 본인 댓글 수정 → OK.
  - ⑨ 남의 댓글 삭제: 본인 OR 공간 관리자/ADMIN → OK, 그 외 → 403.
  - ⑩ 비편집자(뷰어)의 페이지 상태 변경 → 403 / 편집자(작성자 아니어도) → OK.
  - ⑪ 비편집자의 공유 링크 발급·resolve → 403.
  - ⑫ 비관리자의 setHomePage(`PATCH /api/spaces/:id`) → 403.
  - ⑬ PUBLIC 공간의 댓글·리액션·지켜보기 기존 흐름 정상 — 회귀 없음.
