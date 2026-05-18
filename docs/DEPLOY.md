# 배포 가이드 (myConfluence)

## 1. 단일 인스턴스 배포 (사내 PC / 단일 서버 / 권장)

가장 단순한 시나리오. Redis 없이 동작하며 협업 세션 상태는 Hocuspocus
프로세스 메모리에 보관된다. 단일 인스턴스로 모든 사용자가 같은 프로세스에
연결되므로 동기화는 정상.

### Prereq
- Node.js 18 이상
- PostgreSQL 16 + `pg_trgm` extension (검색용)
- 디스크 쓰기 권한 (첨부 파일 저장 경로)

### Bring-up
```bash
git clone <repo-url> myConfluence
cd myConfluence
npm install

# DB는 미리 만들어 두기. 예:
#   CREATE DATABASE docspace;
#   \c docspace
#   CREATE EXTENSION pg_trgm;

# 환경 설정
cp apps/api/.env.example apps/api/.env
# .env 안에서 최소한 DATABASE_URL 만 본인 환경에 맞게 수정.
# USE_REDIS=false (기본) 유지 — Redis 불필요.

cd apps/api
npx prisma migrate deploy
cd ../..

# 개발 실행 (web + api + hocuspocus 동시 기동)
npm run dev:all
```

기본 포트:
- **3000** — Next.js (사용자 접속용)
- **4000** — NestJS API (Next.js가 프록시)
- **1234** — Hocuspocus WebSocket (브라우저가 직접 접속)

방화벽에 3000번과 1234번을 열어두면 LAN 사용자가 접속 가능. 4000번은
Next.js만 호출하므로 외부에 열 필요 없음.

### Production 빌드
```bash
# 한 번 빌드
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..

# 실행 (각각 별도 셸 또는 pm2 등)
node apps/api/dist/src/main          # NestJS + Hocuspocus
cd apps/web && npm start             # Next.js 3000
```

---

## 2. 멀티 인스턴스 배포 (수평 확장)

여러 API 인스턴스를 띄우고 로드밸런서 뒤에 둘 때. Hocuspocus 인스턴스가
다르면 같은 페이지를 편집하는 두 사용자가 서로 다른 메모리 풀에 갇히므로
Redis Pub/Sub 어댑터로 묶어야 한다.

### 추가 Prereq
- Redis 7 이상 (단일 인스턴스 또는 클러스터)

### 변경점
`.env`:
```
USE_REDIS=true
REDIS_HOST=<redis 호스트>
REDIS_PORT=6379
```

이외는 단일 인스턴스 배포와 동일. `USE_REDIS=true`로 켜면 부팅 로그가
`Hocuspocus listening on :1234 with Redis adapter <host>:<port>`로 바뀐다.

### 로드밸런서
- HTTP/HTTPS는 Next.js(3000)으로 라운드 로빈 OK
- WebSocket(1234)은 sticky session **불필요** — Redis Pub/Sub이 인스턴스간
  Yjs awareness 메시지를 전달

---

## 3. 개발용 Docker 환경 (선택)

repo 루트의 `docker-compose.yml` 은 Postgres + Redis + Nginx를 띄운다.
개발 PC에서 클린하게 시작하고 싶을 때 사용:

```bash
docker compose up -d         # docspace_postgres, docspace_redis, docspace_nginx
```

이 경우 `.env`는:
```
DATABASE_URL="postgresql://docspace:docspace@localhost:5432/docspace?schema=public"
USE_REDIS=true               # docker-compose의 redis 사용
REDIS_HOST=localhost
REDIS_PORT=6379
```

사내 PC가 Docker 차단 환경이면 위 1번(단일 인스턴스 + USE_REDIS=false)
경로를 따른다.

---

## 4. 트러블슈팅

| 증상 | 원인/해결 |
|---|---|
| `connect ECONNREFUSED localhost:6379` 로 NestJS 부팅 실패 | `USE_REDIS=false` 로 두거나 Redis 서버 기동 |
| `pg_trgm extension does not exist` | DB에 `CREATE EXTENSION pg_trgm;` 1회 실행 |
| WebSocket 연결 실패(편집기에서 "오프라인" 배너) | 1234 포트 차단 여부 확인. `NEXT_PUBLIC_WS_URL=ws://<host>:1234` 로 명시 설정 가능 |
| Prisma engine 잠금 (Windows에서 nest watch 다중 기동) | 멈춘 `node` 프로세스 정리 후 `npx prisma generate` 재시도 |
