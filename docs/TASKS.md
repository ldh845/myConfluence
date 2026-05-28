# DocSpace — Task 현황 (사람용)

> **목적**: 팀원 업무 공유 · 주간 보고용 문서. 이 파일을 보고 사내 Jira 에
> 입력/갱신한다. 가독성 우선 — 커밋 해시·파일 경로·미세 버그·도구 내부 용어는
> 빼고 "무엇을 했고 결과가 무엇인지"만 담는다.
> **`docs/CYCLES.md` 와의 차이**: CYCLES.md 는 커밋·파일·함정까지 들어가는
> AI/개발자용 상세 개발 로그다. 이 파일은 그 반대 — 사람용 롤업. 깊은 기술
> 디테일이 필요하면 각 Task 의 "관련 Cycle" 로 CYCLES.md 를 본다.
> **시작 시점**: 이 파일은 v1(시간순 retrospective rollup, Cycle 1~46)에서
> v2(주제 중심, Cycle 47~)로 전환했다. Cycle 1~41 은 Task A 에 마일스톤 요약
> 형태로만 보존하고, 상세는 CYCLES.md 에서 본다.
> **갱신 규칙**: 사이클이 끝나면 그 사이클이 *기여한 주제 Task 의 진척* 에 한
> 줄 entry append, *닫힌 남은 일* 은 ✓ 표시(원래 항목은 "닫힘 이력"으로 이동,
> 닫은 cycle 명시), *새로 발견된 todo* 는 해당 Task 의 "남은 일"에 추가.
> **새 Task 는 진짜로 새 주제(완전히 다른 영역)가 emerge 할 때만 추가** —
> 기존 주제의 변형·확장은 기존 Task 안에서 처리한다.

**Task-level 상태 라벨** (CYCLES.md 의 사이클-level `✅/🔄/⛔/⏭/📝` 와는 별도):
🟢 Active — 현재 활발히 진행 / 🟡 Maintenance — 큰 작업 완료, 잔여 보강만 /
🔵 Backlog — 시작 안 함, 우선순위 대기 / ⚫ Closed — 영역 완전 종료 /
⛔ Blocked — 외부 의존으로 진행 불가

---

## Task A — 코어 위키 플랫폼

- **범위**: 페이지·스페이스·편집기·댓글·반응·첨부·다이어그램·버전·검색·페이지
  공유 등 Confluence 대체의 핵심 기능 영역.
- **상태**: 🟡 Maintenance
- **진척**:
  - **Cycles 1~41 — 플랫폼 본체 구축.** 주요 마일스톤:
    - Cycle 10-1/2 — draft/publish 메커니즘 (`Page.draftContent`, autosave,
      publish 트랜잭션)
    - Cycle 27a~e — 사용자·권한 모델 (User FK 연결, 첫 가입자 자동 ADMIN)
    - Cycle 32 — 개인 공간 (SpaceType PERSONAL)
    - Cycle 33 — 공간 homepage (`Space.homePageId`, 공간 진입 시 자동 이동)
    - Cycle 35 — draft 노출 규칙 (`Page.publishedAt`, 첫 발행 전 페이지는
      트리/검색에서 숨김)
    - Cycle 39 — Hocuspocus Redis adapter 토글 (USE_REDIS)
    - Cycle 40 — API 포트 컨벤션 (api PORT == web API_PORT == 3001)
  - 상세는 `docs/CYCLES.md` 1~41 참조.
  - Cycle 49 — 개인 공간 UX 정식화 (OIDC 로그인 시 자동 생성, SystemSidebar
    "+내 공간 추가" 토글, UserMenu "내 개인 공간" 진입). Cycle 32 personal
    space 에 정식 진입점 부여.
  - Cycle 50 — /home 활동 피드를 사용자 활동 5종(페이지 생성/발행/이동/복사 +
    댓글)만 표시하도록 표시 계층 필터링. 백엔드 `?types=` 다중 IN 추가,
    /activity 의 고급 탐색은 시스템 이벤트 포함 유지.
  - Cycle 50 followup — 사용자 피드백으로 노출 범위를 2종(페이지 생성 + 댓글)
    으로 더 축소. 편집/이동/복사는 organize·시스템 성격 노이즈로 제외.
    백엔드 무변경.
  - Cycle 51 — 스페이스 사이드바 '페이지' 메뉴 동작 변경. 첫 페이지 자동
    이동 폐기, 그 공간의 최근 업데이트 페이지 목록(SpacePagesView)으로 이동.
    백엔드 GET /pages/recent 에 spaceId/offset 옵셔널 확장(기존 /home 호환).
  - Cycle 52 — 페이지 조회 화면 본문 폭 제약 제거. max-w-[960px] mx-auto
    폐기로 main 영역 가로 꽉 차게. 편집 모드(Cycle 38 followup)와 동일한
    반응형 패딩 패턴으로 통일해 모드 전환 시 폭 jump 없음.
  - Cycle 53 — 페이지 조회 상단 액션 Confluence 표준 5+1 재구성
    (편집/인라인댓글/저장/지켜보기/공유 + ⋯). SavedPage / WatchList 서버
    모델 신규 + 토글 API. 단축키 E/V/F/W/S 도입(입력 포커스·편집 모드 가드).
  - Cycle 54-D — 편집 툴바에 '+ 더 많은 내용 삽입' 버튼. slash 명령
    카탈로그 재활용해 검색 + 클릭으로 같은 블록 삽입 흐름 제공.
  - Cycle 54-A — 링크 다이얼로그를 Confluence 표준 탭 UI
    (연결 문구/웹 연결)로 재구성. 편집 모드 한정 Ctrl+K 단축키 추가
    (TopNav 검색과 capture phase + stopPropagation 으로 분리).
  - Cycle 54-B — 표 삽입 그리드 8x8 → 10x10 (Confluence 표준).
    셀 폭 22px 고정으로 비좁아짐 방지, '직접 입력'(한도 100x20) 그대로.
  - Cycle 54-F — 날짜 inline atom 노드 신규 (TipTap DateExtension).
    slash/＋ 카탈로그에 '날짜' 항목, 색박스(date lozenge) NodeView,
    클릭 시 prompt 재입력. markdown 직렬화는 텍스트만(라운드트립 시 시각화 손실).
  - Cycle 54-C — 이미지 삽입 통합 다이얼로그(탭: 첨부/웹 URL) + Image
    extension caption attr + figure NodeView. ImageInsertDialog 신규,
    ImageNodeView 신규, ImageAltButton 의미 분리 + ImageCaptionButton 추가.
    기존 image 노드 자연 호환(Yjs migration 0).
  - Cycle 56 — 페이지 삭제 동작 분리 + 라우팅 fix. 기본은 자식 승격(단일),
    cascade=true 만 자손 휴지통. window.confirm → DeletePageDialog(체크박스).
    삭제 후 같은 공간 유지(부모/홈 fallback) — 사용자 보고 "다른 공간으로
    이동" 버그 fix. BE remove() 시그니처 변경 + 9 케이스 spec.
  - Cycle 56 followup — DeletePageDialog 안내 문구 간소화 (사용자 피드백).
    동작 변경 없음.
  - Cycle 55 — @user 멘션 도입 (SRS FR-072). TipTap MentionNode 자체 구현
    (extension-mention 패키지 peer 충돌로 우회), GET /users?q= 검색, popup
    아바타+name+department. Yjs 호환. 알림 트리거는 별도 사이클.
  - Cycle 57 — content 저장 markdown → ProseMirror JSON 전환. 사용자 정의
    노드/마크 라운드트립 한계(멘션/figcaption/inline 댓글/색상 등) 모두
    해결. parseContent 가 '{' 감지로 옛 markdown 자동 호환.
    CLAUDE.md '마크다운 직렬화 한계' 카테고리 종결.
  - Cycle 58 — 사용자 프로파일 페이지 (/?profileId=X) + 편집 모드 멘션
    클릭 popover (연결로 이동/편집/연결해제). GET /users/:id 신규,
    activities.list actorId 필터 추가. 멘션 클릭 라우팅 personal space
    → 프로파일로 변경.
  - Cycle 59 — 멘션 알림. Notification 모델 신규 + 발행 시점 멘션 추출 →
    수신자에게 알림 트리거 (dedupe + 자기 자신 skip + best-effort).
    TopNav 종 아이콘 + dropdown 패널 (60초 polling, unread badge).
    SRS FR-100~ 알림 인프라 1단계.
  - Cycle 60 — 알림 종류 확장 (comment.created / comment.reply). notifyOne
    일반 트리거 추가, comments.service.create 에서 페이지 작성자 / 부모
    댓글 작성자에게 알림. NotificationBellButton type 별 문구·아이콘
    (💬/↩️). 마이그레이션 없음.
  - Cycle 61 — 지켜보는 페이지 발행 알림 (page.updated). WatchList(Cycle 53)
    + Notification 결합 — 지켜보기 기능 완성. notifyWatchers + notifyOne
    refresh 옵션(매 발행마다 재알림). 종 아이콘 👁️. 마이그레이션 없음.
- **남은 일**: (현재 plat-level 큰 항목 없음 — 신규 기능은 Task G)
- **닫힘 이력**: (v1 retro 미수행)
- **차단 / 의존**: 없음
- **Jira Epic**: 미등록
- **관련 Cycle**: Cycle 1~41, 49, 50, 51, 52, 53, 54-D, 54-A, 54-B, 54-F, 54-C, 56, 55, 57, 58, 59, 60, 61

---

## Task B — 인증·인가 (Keycloak OIDC SSO)

- **범위**: Keycloak OIDC 기반 SSO + 단일 로그아웃(SLO) + 권한 모델.
- **상태**: 🟡 Maintenance (AFS 실연동 대기)
- **진척**:
  - Cycle 43 — 백엔드 OIDC 통합 (authorization code flow, ID 토큰 검증,
    계정 매핑 `keycloakId`)
  - Cycle 43 (2/2) — 프론트 SSO 전환 + 자체 인증(아이디/비번·bcrypt) 제거
  - Cycle 43 followups — 단일 로그아웃(SLO, Keycloak end_session), VM 실서버
    SSO 적용·검증
- **남은 일**:
  - AFS Keycloak 실연동 (env 교체만, AFS 팀 의존) — ⛔ Blocked
  - 운영 DB 의 기존 자체 가입 사용자 마이그레이션 (잔여 감사)
- **닫힘 이력**:
  - ✓ 컨테이너로 api 운영 시 issuer 호스트 정합 — Cycle 43 fp + Cycle 44
- **차단 / 의존**: AFS 팀의 Keycloak realm/client 등록·값 전달
- **Jira Epic**: 등록됨
- **관련 Cycle**: Cycle 43 + 43 followups

---

## Task C — 실시간 협업 (Hocuspocus + Yjs)

- **범위**: 페이지 본문 동시 편집, presence/awareness, Redis Pub/Sub 어댑터
  옵션.
- **상태**: 🟡 Maintenance
- **진척**: 코어 사이클들에서 협업 기반 구축 (Yjs/Hocuspocus 통합, Redis
  어댑터 옵션화 등 — Task A 의 Cycle 39 참조).
- **남은 일**:
  - 다이어그램(Excalidraw) 동시 편집 미지원 — 현재 last-write-wins. Task G 와
    연계해 별도 사이클에서 검토.
- **닫힘 이력**: (해당 없음)
- **차단 / 의존**: 없음
- **Jira Epic**: 미등록
- **관련 Cycle**: 코어 사이클들 (상세 CYCLES.md)

---

## Task D — 운영 환경 / 배포 (VM·Docker·compose)

- **범위**: 사내 VM 실서버 구축, Docker 이미지화, docker compose 풀스택 운영,
  배포 자동화(`deploy/`).
- **상태**: 🟢 Active
- **진척**:
  - Cycle 41 — 사내 VM 운영 환경 구축 (초기 nohup 기반 배포)
  - Cycle 42 + followups — Docker 이미지(api/web 멀티스테이지), 개발용
    Keycloak compose, 사내 프록시/CA 빌드 통로, VM 실빌드·런타임 검증
  - Cycle 44 — docker compose 풀스택 단독 운영 전환, HAProxy 제거 (compose
    nginx 가 :8082 직접 발행, 경로 분기)
  - Cycle 45 — 배포 도구 저장소 `deploy/` 편입 (redeploy.sh,
    nginx-stack.conf, docker-compose.override.example.yml)
- **남은 일**: (현재 큰 항목 없음)
- **닫힘 이력**:
  - ✓ 서비스 자동 재시작 (nohup → systemd/PM2) — Cycle 44 compose
    `restart: unless-stopped` 로 해소
  - ✓ 호스트 HAProxy 에 :1234 직접 매핑 검토 — Cycle 44 에서 HAProxy 제거,
    obsolete
  - ✓ 환경별 설정 파일(compose override·nginx) 저장소 편입 — Cycle 45
    `deploy/` 편입
  - ✓ `typescript.ignoreBuildErrors=true` 영구 fix — Cycle 42 followup
    (web 빌드 타입 에러 3곳 영구 수정)
- **차단 / 의존**: 없음
- **Jira Epic**: 등록됨
- **접속 정보**: 웹 http://166.79.31.248:8082 / 첫 가입자 자동 ADMIN /
  SSH `ssh -p 12222 sysadmin@166.79.31.248`
- **관련 Cycle**: Cycle 41 + 42 + 42 followups + 44 + 45

---

## Task E — 운영 안정성·관측

- **범위**: 운영 부채 정리(약한 DB 비번·백업 부재·로그 무한 증가·재부팅 대비) +
  K8s 입주 호환성 선행 정비(health probe, NODE_ENV).
- **상태**: 🟡 Maintenance
- **진척**:
  - Cycle 46 — DB 비번 강화(외부화·hex 32), cron 정기 백업(일별 7+주별 4),
    docker 로그 로테이션(서비스당 50MB), health probe live/ready 분리, api
    NODE_ENV=production, daemon 자동기동 절차
  - Cycle 46 followup — VM 적용·검증 완료(6 영역 모두 통과) + 운영 함정 3건을
    DEPLOY.md 3.12 에 문서화
- **남은 일**:
  - Keycloak `start-dev` 인메모리 H2 → 영속 외부 DB 전환
  - `compose down→up` 후 nginx 네트워크 attach fragility 영구 fix
- **닫힘 이력**:
  - ✓ DB 비밀번호 강화 — Cycle 46
  - ✓ 백업·모니터링 (DB 백업·로그 로테이션) — Cycle 46
  - ✓ VM 재부팅 자동기동 검증 — Cycle 46 followup
  - ✓ EOL CRLF/LF 유령 diff — Cycle 46 (`.gitattributes`)
- **차단 / 의존**: 없음
- **Jira Epic**: 미등록
- **관련 Cycle**: Cycle 46 + 46 followup

---

## Task F — AFS / K8s 입주 준비

- **범위**: 사내 AFS(K8s) 입주를 위한 production 이미지·K8s manifest·Keycloak
  실연동.
- **상태**: 🔵 Backlog (AFS 팀 일정 의존)
- **진척**: (아직 시작 안 함)
- **남은 일**:
  - K8s manifest / Helm chart 스캐폴딩
  - production 이미지 크기 최적화 (현재 api ≈ 1.38GB)
  - AFS Keycloak realm/client 실연동 (Task B 와 연계 — env 교체만)
  - Resource limits · Secret/ConfigMap 템플릿 설계
- **닫힘 이력**: (해당 없음)
- **차단 / 의존**: AFS 팀의 신규 시스템 입주 일정 및 realm 제공
- **Jira Epic**: 미등록
- **관련 Cycle**: (예정 — Cycle 48+ 후보)

---

## Task G — 미구현 기능 (SRS 기반)

- **범위**: SRS 에 명시됐으나 미구현인 기능 영역.
- **상태**: 🔵 Backlog
- **진척**: (아직 시작 안 함)
- **남은 일**:
  - 멘션 (FR-072) + 인앱 알림 (FR-100) — 가장 가시적 가치, 우선순위 높음
  - 알림 종류별 설정 / 이메일 알림 (FR-101 / FR-102)
  - AI 챗 패널 — CLAUDE.md 언급만 있고 SRS 에는 미명세 — **스펙 정의 선행 필요**
  - 다이어그램 동시 편집 (Task C 와 연계)
  - 페이지 본문 내 멘션 (편집기 통합 필요)
- **닫힘 이력**: (해당 없음)
- **차단 / 의존**: 없음 (우선순위 조정만)
- **Jira Epic**: 미등록
- **관련 Cycle**: (예정)

---

## Task H — 관리자 페이지

- **범위**: ADMIN 권한 사용자가 시스템 설정과 사용자 현황을 보는 운영 화면.
- **상태**: 🟡 Maintenance (Phase 1 완료, Phase 2 SMTP 백로그)
- **진척**:
  - Cycle 48 — **Phase 1**: 톱니바퀴(ADMIN 한정 노출, DOM 미생성) + `/admin`
    페이지(일반 설정·사용자 관리). ADMIN 권한 source 를 Keycloak realm role
    로 전환(매 로그인 동기화), Keycloak claim 캐시(email/emailVerified/
    lastLoginAt). 이중 가드(프런트 useAuth + 백엔드 RolesGuard).
- **남은 일**:
  - **Phase 2**: SMTP 설정 + 이메일 발송 인프라(알림·비밀번호 재설정 등)
  - 추가 운영 도구(감사 로그·세션 관리 등) — 필요 시점
  - 본 Task 의 Jira Epic 신규 등록
- **닫힘 이력**: (해당 없음)
- **차단 / 의존**: 없음
- **Jira Epic**: 미등록
- **관련 Cycle**: Cycle 48

---

## 부록 — 옛 Task 1~5 ↔ 새 Task A~G 매핑 (역추적용)

| 옛 | 새 | 비고 |
|---|---|---|
| Task 1 — 사내 VM 운영 환경 구축 | D + (DB 비번/백업 항목은 E) | 닫힘 이력 분산 |
| Task 2 — Docker 이미지 / 개발 환경 | D + (AFS production 이미지는 F) | |
| Task 3 — 자체 인증 → Keycloak OIDC | B | 1:1 |
| Task 4 — 컨테이너 풀스택 단독 운영 | D | 1:1 |
| Task 5 — 운영 안정성 강화 | E | 1:1 |

## 부록 — Cycle ↔ Task 매핑 (검색용)

| Cycle | 영향 Task |
|---|---|
| Cycle 1~41 | A (주) + B/C/D 부분 |
| Cycle 42 + followups | D |
| Cycle 43 + followups | B |
| Cycle 44 | D |
| Cycle 45 | D |
| Cycle 46 + followup | E |
| Cycle 47 | (TASKS 재구조화 자체) |
| Cycle 48 | H |
| Cycle 49 | A |
| Cycle 50 | A |
| Cycle 51 | A |
| Cycle 52 | A |
| Cycle 53 | A |
| Cycle 54-D | A |
| Cycle 54-A | A |
| Cycle 54-B | A |
| Cycle 54-F | A |
| Cycle 54-C | A |
| Cycle 56 | A |
| Cycle 55 | A |
| Cycle 57 | A |
| Cycle 58 | A |
| Cycle 59 | A |
| Cycle 60 | A |
| Cycle 61 | A |

---

> **프론트 항목 제외 명시**: 옛 Task 1·4 의 "편집기 첫 진입 시 '업데이트' 버튼
> 비활성화 race condition" 등 프론트 도메인 항목은 v2 로 이관하지 않는다 —
> 동훈 님 도메인 밖이라 cross-ref 도 부담. 동료 트래커 / `Issue_list.md` 에서
> 관리한다.
