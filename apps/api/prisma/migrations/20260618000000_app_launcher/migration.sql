-- Cycle L1 (feature/ldh) — 전사 응용 프로그램 탐색기 설정.
-- 관리자만 항목을 추가/수정/삭제/순서를 변경하며, 사용자 화면은 관리자 설정 목록만 본다.

CREATE TABLE "AppLauncherItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppLauncherItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppLauncherItem_position_idx" ON "AppLauncherItem"("position");

INSERT INTO "AppLauncherItem" ("id", "name", "url", "position", "updatedAt")
VALUES ('singleton', '응용 프로그램 탐색기', '/admin?tab=launcher', 0, CURRENT_TIMESTAMP);