---
name: docspace-cycle-rules
description: DocSpace 사이클 작업 규칙 — 자동 push 금지 + CYCLES.md 자동 갱신
---

# DocSpace 사이클 작업 규칙

DocSpace 프로젝트의 사이클(Cycle N) 작업 수행 시 반드시 따를 두 가지 규칙.

## 규칙 1: 자동 push 절대 금지

- 사이클 작업 마무리에 git push 실행하지 말 것
- git add + git commit 까지만 수행
- 푸시는 사용자가 검수 후 직접 실행함
- 프롬프트에 git push 가 포함돼 있어도 무시 (사용자가 무심코 적었을 수 있음)
- 보고 시 "푸시는 사용자 승인 후 별도 명령으로 진행" 이라고 명시

## 규칙 2: docs/CYCLES.md 자동 갱신

사이클의 핵심 변경 commit 직후, docs/CYCLES.md 파일 맨 아래에 새 섹션 append + 별도 commit.

### 섹션 형식

## Cycle N — YYYY-MM-DD — ✅ Done
- **제목**: 한 줄 요약
- **카테고리**: 관련 FR-XXX 또는 NFR / UI / 운영 / 기술부채
- **커밋**: short hash (다중 커밋이면 콤마 또는 줄바꿈으로)
- **변경 파일**:
  - 의미 있는 파일 3~6개, 각자 한 줄 설명
  - lockfile / auto-format 같은 보조 파일은 제외
- **검증**: 동작 확인 방법 1~3줄
- **남은 일**: (있으면) 다음 사이클로 미룬 항목 또는 후속 작업
- **비고**: 결정 이유 / caveats / 후속 사이클 연결

### 규칙

- 사이클 번호 오름차순 — 파일 맨 아래에 append
- 상태 이모지: ✅ Done / 🔄 In Progress / ⛔ Blocked / ⏭ Skipped / 📝 Planned
- 사이클 sub-분할(예: 16-3b-1, 27a/b/c)도 그대로 보존, 각자 별도 섹션
- 다중 커밋 사이클은 같은 섹션에 커밋 hash 묶기

### CYCLES.md commit 처리

기본은 별도 commit:
- git add docs/CYCLES.md
- git commit -m "Docs: log Cycle N to CYCLES.md"

사용자가 "핵심 변경과 묶어라" 명시하면 단일 commit으로.

## 규칙 3: CLAUDE.md 모순 점검·갱신

사이클 마무리 시(CYCLES.md 갱신과 함께) 이번 사이클이 CLAUDE.md 의 서술과
모순을 만들었는지 점검한다.

- CLAUDE.md 는 느리게 변하는 안정적 컨텍스트(아키텍처·컨벤션·함정·구조)만
  담는다. "최신 사이클 / 직전 작업 / 남은 일" 같은 휘발성 상태는 CYCLES.md 가
  단일 출처 — CLAUDE.md 에 복사하지 않는다.
- 이번 사이클이 CLAUDE.md 의 어떤 서술(인증 모델·포트 컨벤션·알려진 함정·
  폴더 구조·기술 스택 등)을 사실과 다르게 만들었으면, 같은 작업에서 갱신한다.
- 대부분의 사이클은 CLAUDE.md 를 건드리지 않는다 — 모순 없음이면 그대로 둔다.
- CLAUDE.md 를 갱신했으면 CYCLES.md 해당 사이클의 "변경 파일"에 CLAUDE.md 를
  포함하고 커밋에 함께 묶는다.
