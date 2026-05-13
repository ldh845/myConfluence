-- FR-001 / FR-002 (Cycle 27a) — User + Role enum.
-- 자체 인증(JWT httpOnly cookie). 첫 가입자만 자동 ADMIN.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'PART_LEADER', 'DEVELOPER', 'DESIGNER', 'PM');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "User" (
  "id"           TEXT NOT NULL,
  "username"     TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "department"   TEXT NOT NULL,
  "role"         "Role" NOT NULL DEFAULT 'DEVELOPER',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key"
  ON "User" ("username");
