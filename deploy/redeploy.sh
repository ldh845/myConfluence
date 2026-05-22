#!/bin/bash
# DocSpace 재배포 스크립트 (docker compose)
# 사용: ./deploy/redeploy.sh [--no-build]   (저장소 루트 docspace 에서 실행)
#   --no-build : 이미지 재빌드 없이 컨테이너만 재기동 (override/conf 만 바꿨을 때)
set -e

DOCSPACE=~/docspace   # 저장소 클론 위치 (DEPLOY.md 컨벤션)
cd "$DOCSPACE"

# === 환경 특정 값 (사내 프록시 + 외부 WS URL) ===
# docker compose build 안의 npm ci 가 npmjs.org 에 접속하므로 빌드엔 프록시 필요.
# 사내 root CA 는 ca-certs/ 에 있어야 함 (Dockerfile 이 자동 신뢰).
# ▼ 다른 환경에 배포하면 이 블록의 값만 그 환경에 맞게 수정.
export HTTP_PROXY=http://16.7.241.20:8080
export HTTPS_PROXY=http://16.7.241.20:8080
export NO_PROXY=localhost,127.0.0.1
export NEXT_PUBLIC_WS_URL=ws://166.79.31.248:8082/collab

# === 옵션 파싱 ===
NO_BUILD=false
for arg in "$@"; do
  case $arg in
    --no-build) NO_BUILD=true ;;
  esac
done

# === Stash cleanup — 중단/에러 시 자동 복원 ===
STASH_TAG="redeploy-autostash-$$"
STASHED=false
cleanup() {
  if [ "$STASHED" = "true" ]; then
    cd "$DOCSPACE" 2>/dev/null || true
    if git stash list 2>/dev/null | grep -q "$STASH_TAG"; then
      echo ""
      echo "  ⚠️ 스크립트 중단 — local 변경사항 자동 복원 시도..."
      if git stash pop >/dev/null 2>&1; then
        echo "  → 자동 복원 완료"
      else
        echo "  ❌ 자동 복원 실패. 수동: git stash list / git stash pop"
      fi
    fi
  fi
}
trap cleanup EXIT

echo ""
echo "============================================"
echo "  DocSpace 재배포 시작 (docker compose)"
echo "============================================"

# [1/5] git pull (auto-stash)
echo ""
echo "[1/5] 최신 코드 가져오기 (git pull)..."
cd "$DOCSPACE"
if ! git diff --quiet || ! git diff --cached --quiet; then
  git stash push -u -m "$STASH_TAG" >/dev/null
  STASHED=true
  echo "  → local 변경사항 임시 stash (태그: $STASH_TAG)"
fi
HTTP_PROXY= HTTPS_PROXY= git pull --rebase origin feature/cycle-2
if [ "$STASHED" = "true" ]; then
  if git stash list | grep -q "$STASH_TAG"; then
    git stash pop >/dev/null
    STASHED=false
    echo "  → local 변경사항 복원 완료"
  fi
fi

# [2/5] DB 백업 (마이그레이션 안전망)
echo ""
echo "[2/5] DB 백업..."
mkdir -p ~/db-backups
BACKUP_FILE=~/db-backups/docspace-$(date +%Y%m%d-%H%M%S).sql
sudo docker compose exec -T postgres pg_dump -U docspace --no-owner docspace > "$BACKUP_FILE"
echo "  → 백업 저장: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# [3/5] 이미지 빌드
if [ "$NO_BUILD" = false ]; then
  echo ""
  echo "[3/5] 이미지 빌드 (api, web)..."
  cd "$DOCSPACE"
  sudo -E docker compose build api web
  echo "  → 빌드 완료"
else
  echo ""
  echo "[3/5] 이미지 빌드 건너뜀 (--no-build)"
fi

# [4/5] 컨테이너 재기동
echo ""
echo "[4/5] 컨테이너 재기동 (docker compose up -d)..."
cd "$DOCSPACE"
sudo -E docker compose up -d
echo "  → 재기동 완료 (api 기동 시 prisma migrate deploy 자동 실행)"

# [5/5] 완료 검증
echo ""
echo "[5/5] 완료 검증 (부팅 대기 15초)..."
sleep 15
echo ""
echo "============================================"
echo "  컨테이너 상태"
echo "============================================"
sudo docker compose ps
echo ""
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/ || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ]; then
  echo "✅ 재배포 완료!  http://166.79.31.248:8082 확인하세요. (/ → HTTP $HTTP_CODE)"
else
  echo "⚠️ :8082 응답 HTTP $HTTP_CODE — 로그 확인:"
  echo "   sudo docker compose logs --tail=50 api"
  echo "   sudo docker compose logs --tail=50 web"
  echo "   sudo docker compose logs --tail=50 nginx"
fi
