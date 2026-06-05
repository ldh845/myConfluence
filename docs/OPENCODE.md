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
