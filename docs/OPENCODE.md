# OpenCode Session Log

> AI(Agent) 가 진행한 작업 이력. 수동 기록, git commit과는 별도.

---

## 2026-06-05 — 아이콘 매핑 + 시스템명 변경

### 변경 파일

| 파일 | 변경 내용 |
|------|---------|
| `AppIcon.tsx` | 4개 아이콘 등록 (`cellDivide`, `cellMerge`, `space`, `tag`) |
| `EditorToolbar.tsx` | 셀 병합/나누기 버튼: 텍스트(`⊞⊟`, `⊟⊞`) → `cellMerge`/`cellDivide` 아이콘 |
| `InfoPanelDialog.tsx` | 미리보기 정보 아이콘: `ⓘ` 이모지 → `information` 아이콘 |
| `InfoPanelNodeView.tsx` | 편집기 렌더 정보 아이콘: `ⓘ` 이모지 → `information` 아이콘 |
| `StatusMacroDialog.tsx` | 상태 배지 미리보기 아이콘 추가 → `tag` 아이콘 |
| `StatusBadgeNodeView.tsx` | 상태 배지 렌더링에 `tag` 아이콘 추가 |
| `TopNav.tsx` | 로고(파란 M) → `space.png` (투명 배경) + 시스템명 `myConfluence` → `DocSpace` |
| `layout.tsx` | 페이지 타이틀 `myConfluence` → `DocSpace` |
| `LabelBar.tsx` | 레이블 바 아이콘: `🏷️` 이모지 → `tag` 아이콘 |
| `layout.tsx` | 브라우져 탭 아이콘(favicon) → `space.png` 적용

### 이슈 해결

- **space.png 배경이 파랗게 처리됨** → `TopNav.tsx` 에서 `bg-[#0052cc]` 배경 제거, AppIcon 도 투명 배경 유지
- **페이지 조회 시 레이블(`tag`) 아이콘이 이모지(🏷️)로 표시됨** → `LabelBar.tsx` 의 이모지 부분을 `AppIcon name="tag"` 로 교체

### 파일 구조 참고
- `InfoPanelDialog.tsx` / `StatusMacroDialog.tsx` — 삽입 다이얼로그 (미리보기)
- `InfoPanelNodeView.tsx` / `StatusBadgeNodeView.tsx` — 에디터에서 실제 렌더링 (ReactNodeView)
- `renderHTML` (tiptap extension) — ProseMirror → HTML 직렬화용 (현재 NodeView 우선)

---

## 2026-06-05 — 알림/지켜보기 기능 활성화 + 구체화

### 변경 파일

| 파일 | 변경 내용 |
|------|---------|
| `AppIcon.tsx` | `crossedEye` 아이콘 등록 (`crossed-eye.svg` 매핑) |
| `PageHeader.tsx` | **지켜보기 기능 활성화**: `disabled` 제거, `watch` ↔ `crossedEye` 아이콘 토글, `W` 단축키 복귀 |
| `NotificationBellButton.tsx` | **UI 아이콘 교체** (이모지 → AppIcon), **Polling 1분→10초**, 알림 설정 다이얼로그(멘션/댓글/업데이트별 수신 설정, localStorage 기반), 알림 센터(/notifications) 링크 추가 |
| `app/(app)/notifications/page.tsx` | **신규 작성**: 알림 센터 전용 페이지 (타입별 필터 탭: 전체/미읽음/멘션/댓글/업데이트, 페이지네이션 100 개, 모두 읽음 처리) |

### 기능 상세

- **지켜보기 (Watch)**: Backend API(`/pages/:id/watch`) 가 이미 동작 중. FE 에서 활성화하여 `WatchList` 토글 + `notifyWatchers` 알림 연동.
- **실시간성**: Polling `refetchInterval` 60 초 → 10 초로 단축. (향 후 SSE/WebSocket 도입 단계 분리)
- **알림 설정**: `localStorage` 로 현재 사용자의 알림 유형별 수신 여부 저장. Backend `User.notificationPrefs` 필드 연동은 추 후.
- **UI 아이콘**: `NotificationBellButton` 드롭 다운 알림 목록 및 `notifications/page.tsx` 에서 `ⓘ/🏷️/🔔` 이모지 → `AppIcon` 으로 교체. `NotificationBellButton` 헤더에 '알림 센터 >' 링크와 '설정' 버튼 추가.

### 이슈 해결

- **지켜보기 비활성화**: `Cycle 61 followup` 에서 비활성화 상태 → 활성화 + 아이콘/단축키 복원.
- **NotificationBellButton 아이콘 이모지**: 아이콘 파일로 교체.
