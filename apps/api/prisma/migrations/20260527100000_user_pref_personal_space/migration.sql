-- Cycle 49 — 사용자 환경설정 1건: SystemSidebar 에 본인 personal space 를
-- 항상 표시할지 토글. default false (오프) — 사용자가 명시적으로 켜야 노출.
-- 향후 prefs 가 더 늘면 UserPreferences 테이블로 분리 검토.
ALTER TABLE "User" ADD COLUMN "showPersonalSpaceInSidebar" BOOLEAN NOT NULL DEFAULT false;
