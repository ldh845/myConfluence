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
- **상태**: 🟡 Maintenance (L1~L4 + L4 followup 구현·VM 검증 완료 — 2026-06-05)
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
- **남은 일**: 없음 — Task L-AUTH 종료.
  - (L4 감사 로그(역할 변경 이력)는 ActivityLog 페이지/공간 중심 한계로 deferred.)
- **검증 완료(VM)**:
  - L4 followup(2026-06-05) — ⑩ 역할 변경이 재로그인 없이 최초부터 즉시 반영 / ⑪
    `/api/auth/me` 응답 `Cache-Control: no-store` / ⑫ 본문 이미지 새로고침 캐시 로드(성능
    저하 없음) 전부 확인. → L4 followup 시나리오 ⑩~⑫ 종결.
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
- **상태**: 🟡 Maintenance (L5~L8 ✅ 구현 완료 + L9(접근 권한 역산 API) ✅ — L9-2 조회 화면만 남음)
- **하위 사이클**:
  - **L5** — 권한 가드 구멍 보강: 무인증 쓰기(🔴4) + 데이터 누수 읽기(🟠10) 폐쇄
    + `assertCanViewPage` 프리미티브. ✅ Done
  - **L5-2** — 인증됐으나 공간/페이지 권한 미검사 쓰기(🟡13: 댓글 작성/수정/삭제·resolve,
    리액션 toggle, watch, page-share 발급/회전/취소, 페이지 상태 변경, setHomePage) 보강.
    확정 정책 12항목 적용. ✅ Done
  - **L6** — 그룹 모델(Group/GroupMember, source LOCAL/KEYCLOAK) + 관리자 그룹 관리
    (CRUD·멤버, KEYCLOAK 보호 가드). 권한 판정 영향 없음(그릇만). ✅ Done
  - **L7** — 스페이스 권한에 그룹 적용. `SpaceMemberGroup` + `loadAccess` max 결합
    (개인∪그룹, 높은 쪽 승리, **deny 없음**) + 공간 권한 탭 그룹 섹션. ✅ Done
  - **L7-2** — 페이지 단위 제한(83)에 그룹 적용. `PageRestrictionGroup` +
    `effectivePageRestrictionRole` max 결합(개인∪그룹, EDIT>VIEW, **deny 없음**) +
    제한 다이얼로그 '허용 그룹' 섹션. ✅ Done
  - **L8** — Keycloak 그룹 동기화(OIDC 로그인 시 KEYCLOAK 멤버십 정렬, LOCAL 불가침,
    best-effort). ✅ Done
  - **L9** — 접근 권한 역산 API(effective-access): 공간/페이지를 볼 수 있는 사용자
    전부+경로(via)·유효 역할. 개인∪그룹 합침, PUBLIC everyone, 전역 ADMIN 별도. BE only. ✅ Done
  - **L9-2** — 접근 권한 조회 화면(FE). 📝 Planned
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
  - **Cycle L6 (2026-06-05) ✅** — 그룹 모델(마이그레이션 1건: groups/group_members,
    GroupSource enum) + 관리자 그룹 관리 BE(7개 라우트, ADMIN 전용) + FE '그룹' 탭
    (CRUD·멤버 추가/제거, UserSearchCombobox 재활용). source=KEYCLOAK 보호 가드(403)
    L8 대비 선반영. 권한 판정 무변경. api/web tsc·nest build EXIT 0, jest 261 passed(26 suites).
    상세는 `docs/CYCLES-ldh.md` Cycle L6.
  - **Cycle L7 (2026-06-05) ✅** — 스페이스↔그룹 권한 결합. 마이그레이션 1건
    (space_member_groups). 판정 단일 변경점: `loadAccess` 가 유효 역할 = max(개인 멤버십,
    소속 그룹 부여 역할들) 반환 → 모든 canX/assertCanX 자동 반영. 가시성 필터에도 그룹
    PRIVATE 가지 추가. 그룹 권한 부여 API(공간 manage) + `GET /groups` 디렉터리 + 공간
    권한 탭 '그룹' 섹션. 기존 개인 권한 동작 불변(canX 회귀 테스트 전부 통과). api/web
    tsc·nest build EXIT 0, jest 273 passed(26 suites). 상세는 `docs/CYCLES-ldh.md` Cycle L7.
  - **Cycle L7-2 (2026-06-08) ✅** — 페이지 단위 제한↔그룹 결합. 마이그레이션 1건
    (page_restriction_groups, enum 재사용). 판정 단일 헬퍼 `effectivePageRestrictionRole`
    = max(개인 PageRestriction, 소속 그룹 PageRestrictionGroup) → assertCanEditPage/
    assertCanViewPageRestriction 가 호출. 작성자/공간관리자/전역 ADMIN 우회 불변. 제한
    PATCH 에 groups 원자 합류(모드 변경 시 초기화, EDIT=role EDIT 강제) + GET 응답 groups.
    제한 다이얼로그 '허용 그룹' 섹션(GET /groups 재사용). 기존 개인 제한 동작 불변(제한
    테스트 전부 통과). api/web tsc·nest build EXIT 0, jest 287 passed(26 suites). 상세는
    `docs/CYCLES-ldh.md` Cycle L7-2.
  - **Cycle L8 (2026-06-08) ✅** — Keycloak 그룹 동기화. 마이그레이션 없음(기존 그룹
    모델 재사용). realm 시드에 group-membership 매퍼 + dev-team1/dev-team2 + testuser2
    영구화. oidc.service 가 `groups` claim 추출, auth.service.findOrCreateOidcUser 가
    로그인 시 KEYCLOAK source 멤버십을 claim 집합과 정렬(undefined 스킵, [] 전부 제거,
    그룹명 upsert, 동명 LOCAL 스킵, LOCAL 멤버십 불가침, 트랜잭션+best-effort). api tsc·
    nest build EXIT 0, jest 294 passed(26 suites). 상세는 `docs/CYCLES-ldh.md` Cycle L8.
  - **Cycle L9 (2026-06-08) ✅** — 접근 권한 역산 API(BE only). GET /spaces|pages/:id/
    effective-access — 개인 SpaceMember ∪ 그룹 SpaceMemberGroup(공간) / PageRestriction ∪
    PageRestrictionGroup(페이지, VIEW_EDIT 좁힘)을 사용자 단위 합침(via·role max). PUBLIC
    everyone, 전역 ADMIN globalAdmins:{count}, 작성자/공간관리자 우회 via 표기. 게이트=공간
    canManage/전역 ADMIN. N+1 없음, 마이그레이션 없음. 판정과 동일 max 규칙 공유(일관성
    테스트). api tsc·nest build EXIT 0, jest 306 passed(27 suites). 상세는
    `docs/CYCLES-ldh.md` Cycle L9.
- **남은 일**:
  - L9 VM 검증(콘솔 fetch) — 아래 시나리오 ①~③.
  - L9-2(접근 권한 조회 화면 FE) 구현.
- **L7-2 VM 검증 시나리오**:
  - ① "편집 제한" + 그룹(EDIT) → 그룹 멤버가 편집 가능, 비멤버는 보기만.
  - ② "보기+편집 제한" + 그룹(VIEW) → 그룹 멤버는 보기만, 그룹 밖은 페이지 403.
  - ③ 모드 변경 시 그룹 멤버십도 초기화(개인 멤버와 함께).
  - ④ 제한 없는·개인 제한만 쓰는 페이지는 변화 없음(회귀).
- **L8 VM 검증 시나리오**:
  - ① testuser2 SSO 로그인 → 그룹 탭에 dev-team1 이 KEYCLOAK 배지로 자동 생성 +
    testuser2 멤버(편집 컨트롤 비활성).
  - ② dev-team1 에 공간 편집자 부여 → testuser2 편집 가능.
  - ③ LOCAL 그룹(개발1팀) 멤버십은 로그인 후에도 그대로(불가침).
  - ④ 로컬 로그인(localtest)은 그룹 변화 없음.
- **L9 VM 검증 시나리오(콘솔 fetch)**:
  - ① admin 콘솔에서 비공개 공간 `GET /api/spaces/:id/effective-access` → 개인+그룹 멤버가
    via 와 함께(겹치면 via 둘·role max), 전역 ADMIN 은 globalAdmins.count 로.
  - ② 제한(VIEW_EDIT) 건 페이지 `GET /api/pages/:id/effective-access` → 공간 접근자보다
    좁혀지고 제한 멤버/작성자/공간관리자만 남는지.
  - ③ localtest(비관리자)로 호출 시 403.
- **검증 완료(VM)**:
  - **L8(2026-06-08)** — ① testuser2 SSO 로그인 시 dev-team1 이 KEYCLOAK 배지로 자동 생성
    + testuser2 멤버(편집 컨트롤 비활성), ② dev-team1 에 공간 편집자 부여 → testuser2 편집
    가능(PRIVATE 공간 확인), ③ LOCAL 그룹 멤버십 로그인 후에도 그대로, ④ 로컬 로그인 그룹
    변화 없음 — 전부 합격. ※ 검증 중 "뷰어인데 편집됨" 혼선은 PUBLIC 공간이 로그인 사용자
    누구나 편집 가능한 설계 때문이었고 PRIVATE 공간으로 재확인해 해소. → L8 시나리오 ①~④ 종결.
  - **L7-2(2026-06-08)** — "편집 제한"+그룹(EDIT) 부여 → 그룹 멤버 편집 가능·비멤버
    보기만, 모드 변경 시 그룹 멤버십 초기화, 제한 없는·개인 제한만 쓰는 페이지 변화
    없음(회귀) — 전부 합격. ※ 검증 중 "제한이 안 걸린다" 혼선은 작성자/공간관리자/전역
    ADMIN 우회 경로 때문이었고 일반 계정 테스트로 해소 — 이 우회는 Cycle 83 의 의도된
    설계(관리 주체는 항상 접근). → L7-2 시나리오 ①~④ 종결.
  - **L7(2026-06-05~06)** — ① 비공개 공간에 그룹을 편집자로 부여 → 그룹 멤버(개인 권한
    없는 사용자) 편집 가능, ② 그룹/그룹권한 제거 → 접근 불가, ③ 개인 편집자+그룹 뷰어 →
    편집 유지(max, 그룹이 강등 못 함), ④ 개인 권한만 쓰던 공간 변화 없음(회귀) — 전부 합격.
    → L7 시나리오 ①~④ 종결.
  - **L6(2026-06-05)** — admin 그룹 탭에서 그룹 생성·멤버 추가/제거·삭제 확인,
    localtest(DEVELOPER)의 /admin 접근 차단 유지, 기존 기능 무영향 확인. → L6 시나리오 종결.
  - **L5(2026-06-05)** — ④⑥ UI 확인(비멤버의 활동 피드·휴지통에 비공개 항목 미노출 +
    PUBLIC 공간 기존 흐름 회귀 없음), ①⑤ 콘솔 fetch 로 403 확인(비공개 페이지 댓글 목록·
    버전 이력·첨부 업로드). ②③ 은 동일 프리미티브(assertCanViewPage/EditPage) 재사용
    경로 + 단위 테스트 커버를 근거로 검증 생략 결정. → L5 시나리오 ①~⑥ 종결.
  - **L5-2(2026-06-05)** — ⑦(뷰어 댓글 작성 OK)·⑧(타인 댓글 수정 불가/본인 OK)·⑩(뷰어
    상태변경 불가 → 편집자 승급 후 OK, 작성자 아니어도) UI 합격. ⑨⑪⑫ 는 콘솔 전용
    항목이라 동일 프리미티브 재사용 + 단위 테스트 커버 근거로 생략. ⑬(PUBLIC 회귀)은
    일상 사용에서 이상 없음 확인. → L5-2 시나리오 ⑦~⑬ 종결.
- **L5-2 VM 검증 시나리오**:
  - ⑦ 뷰어(읽기 권한만)가 공개 공간 페이지에 댓글 작성 → OK / 비공개 비멤버는 403.
  - ⑧ 남의 댓글 수정 → 403(공간 관리자·전역 ADMIN 으로도 403), 본인 댓글 수정 → OK.
  - ⑨ 남의 댓글 삭제: 본인 OR 공간 관리자/ADMIN → OK, 그 외 → 403.
  - ⑩ 비편집자(뷰어)의 페이지 상태 변경 → 403 / 편집자(작성자 아니어도) → OK.
  - ⑪ 비편집자의 공유 링크 발급·resolve → 403.
  - ⑫ 비관리자의 setHomePage(`PATCH /api/spaces/:id`) → 403.
  - ⑬ PUBLIC 공간의 댓글·리액션·지켜보기 기존 흐름 정상 — 회귀 없음.
