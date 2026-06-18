#!/bin/sh
# DocSpace API entrypoint
# DB_USER + POSTGRES_PASSWORD가 있으면 DATABASE_URL에 계정/비밀번호를 조합
# prisma migrate deploy가 DATABASE_URL을 필요로 하므로 앱 시작 전에 설정해야 함
#
# DATABASE_URL 형식:
#   - docker-compose: 전체 URL (postgresql://user:pw@host:5432/db) → 조합 스킵
#   - k8s:            베이스 URL (postgresql://host:5432/db) + DB_USER + POSTGRES_PASSWORD → 조합

if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ]; then
  export DATABASE_URL=$(echo "$DATABASE_URL" | sed "s|://|://${DB_USER}:${DB_PASSWORD}@|")
fi

# Prisma 마이그레이션 적용 후 서버 시작
node_modules/.bin/prisma migrate deploy && node dist/src/main