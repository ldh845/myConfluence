#!/bin/bash
# DocSpace DB 정기 백업 (cron 용).
# 보존 정책: 일별 7개 + 주별 4개 (일요일 분은 weekly 디렉터리에 hardlink 사본).
# 사용 예 (cron):
#   0 3 * * * /home/sysadmin/docspace/deploy/db-backup.sh >> /home/sysadmin/db-backup.log 2>&1
set -e

DOCSPACE=~/docspace
BACKUP_ROOT=~/db-backups
DAILY_DIR="$BACKUP_ROOT/daily"
WEEKLY_DIR="$BACKUP_ROOT/weekly"
DAILY_KEEP=7
WEEKLY_KEEP=4

cd "$DOCSPACE"
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

TS=$(date +%Y%m%d-%H%M%S)
DOW=$(date +%u)   # 1=월요일 ... 7=일요일

# 1) 일별 백업 → gzip
DAILY_FILE="$DAILY_DIR/docspace-$TS.sql"
sudo docker compose exec -T postgres pg_dump -U docspace --no-owner docspace > "$DAILY_FILE"
gzip -f "$DAILY_FILE"
DAILY_FILE="$DAILY_FILE.gz"
echo "[$(date '+%F %T')] daily : $DAILY_FILE ($(du -h "$DAILY_FILE" | cut -f1))"

# 2) 일요일이면 weekly 디렉터리에 hardlink 사본 (디스크 절약, 내용 동일)
if [ "$DOW" = "7" ]; then
  WEEKLY_FILE="$WEEKLY_DIR/docspace-weekly-$(date +%Y%m%d).sql.gz"
  ln -f "$DAILY_FILE" "$WEEKLY_FILE"
  echo "[$(date '+%F %T')] weekly: $WEEKLY_FILE (hardlink)"
fi

# 3) 보존 정책 — 신규순으로 KEEP 개만 남기고 나머지 삭제 (멱등)
ls -1t "$DAILY_DIR"/docspace-*.sql.gz 2>/dev/null  | tail -n +$((DAILY_KEEP + 1))  | xargs -r rm -f
ls -1t "$WEEKLY_DIR"/docspace-weekly-*.sql.gz 2>/dev/null | tail -n +$((WEEKLY_KEEP + 1)) | xargs -r rm -f

DAILY_COUNT=$(ls -1 "$DAILY_DIR"/docspace-*.sql.gz 2>/dev/null | wc -l)
WEEKLY_COUNT=$(ls -1 "$WEEKLY_DIR"/docspace-weekly-*.sql.gz 2>/dev/null | wc -l)
echo "[$(date '+%F %T')] retention: daily $DAILY_COUNT/$DAILY_KEEP, weekly $WEEKLY_COUNT/$WEEKLY_KEEP"
