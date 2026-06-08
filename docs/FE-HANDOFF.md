# FE 작업 인계 (ldh → kmj)

> 인증·권한 트랙(Task L-AUTH / L-AUTHZ) 진행 중 백엔드는 끝났지만 화면이 없어 미뤄둔
> FE 작업 모음. 각 항목에 BE 준비 상태(엔드포인트)·맥락 포함. 상세는 docs/CYCLES-ldh.md.
> 작성 2026-06-08 / 대상: feature/kmj

## 1. 하위 페이지 생성 진입점 복원
- 무엇: 트리에서 "하위 페이지 만들기" 방법이 현재 없음.
- 왜: Cycle 77 에서 트리 호버 ＋/× 버튼 제거 시 진입점도 같이 사라짐.
- BE 상태: 핸들러 살아있음. Sidebar.tsx 의 onCreatePage(spaceId, parentId) prop 유지, 버튼만 제거됨.
- 요청: 호버 버튼 대신 페이지 "⋯ 메뉴" 또는 트리 우클릭 메뉴로 재연결. onCreatePage 에 현재 페이지 id 를 parentId 로.

## 2. 내 권한 가시화
- 무엇: 사용자가 자기가 뷰어/편집자/관리자인지 알 방법 없음.
- 요청: 공간 헤더/페이지에 "내 권한" 배지 + 403 시 친절 안내.
- BE 상태: 역할 노출 API 아직 없음 → ldh 가 먼저 만들어야 함. 착수 전 ldh 와 스펙 조율.

## 3. 접근 권한 조회 화면 (L9-2)
- 무엇: "이 공간/페이지 누가 볼 수 있나" 관리자 화면.
- BE 상태: 완료(L9). GET /api/spaces|pages/:id/effective-access (조회 권한: 공간 canManage 또는 전역 ADMIN, 아니면 403).
  응답: { everyone, users:[{userId,username,name,department,role,via}], total, limit, offset, globalAdmins:{count} }
  via: "personal" / {group:{id,name}} / "owner" (복수). role: 개인·그룹 max. everyone:true=PUBLIC. 페이지는 VIEW_EDIT 시 좁혀짐.
- 요청: 표로. via 사람이 읽게, 그룹 묶음("개발1팀(12명)"), 페이지네이션.

## 4. 부서↔그룹 매핑 화면 (L10-2)
- 무엇: 부서 자동 권한(L10) 관리 화면.
- BE 상태: 완료(L10). 자동 배정·자동 권한 동작 중. DepartmentGroupMapping(department→groupId) CRUD 화면 필요(관리 엔드포인트 별도 필요 시 ldh 와 확인). 배지 DEPARTMENT 는 이미 추가됨.
- 요청: ① 매핑 등록/수정/삭제 화면(먼저) ② 부서→공간 권한 일괄 부여(후속).

## 참고 — 그룹 source 3종
- LOCAL(수동, 편집 가능) / KEYCLOAK(L8 동기화, 잠금) / DEPARTMENT(L10 부서자동, 잠금)
- 멤버 편집 UI 는 LOCAL 만 활성.
