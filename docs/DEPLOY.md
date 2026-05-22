# 배포 가이드 (DocSpace)

## 1. 단일 인스턴스 배포 (사내 PC / 단일 서버 / 권장)

가장 단순한 시나리오. Redis 없이 동작하며 협업 세션 상태는 Hocuspocus
프로세스 메모리에 보관된다. 단일 인스턴스로 모든 사용자가 같은 프로세스에
연결되므로 동기화는 정상.

### Prereq
- **Node.js 22 이상 (Hocuspocus 4 는 ESM 의존이라 Node 18 + CJS 에선 `ERR_REQUIRE_ESM`; 또한 `@hocuspocus/server`·`chevrotain` 이 engines `node>=22` 를 요구 — Cycle 42에서 컨테이너 베이스를 node:22 로 상향)**
- PostgreSQL 16 + `pg_trgm` extension (검색용)
- 디스크 쓰기 권한 (첨부 파일 저장 경로)

### Bring-up
```bash
# 저장소 이름은 myConfluence(GitHub 식별자) 그대로 두고 로컬 폴더만 docspace로
git clone https://github.com/ldh845/myConfluence.git docspace
cd docspace
npm install
```

#### 사내 VM (외부망 제한 + 프록시 환경)
사내 VM(예: Ubuntu 24.04)은 인터넷 직접 접속이 막혀 있고 사내 프록시와
사내 root CA 를 거쳐야 한다. `npm install` / `git clone` / Prisma 엔진
다운로드가 모두 이 경로를 타므로 셋업 *전에* 아래를 먼저 잡는다.

```bash
# 1) 사내 프록시 — 셸 환경변수 + npm + git 세 곳 모두 지정
export HTTP_PROXY=http://16.7.241.20:8080
export HTTPS_PROXY=http://16.7.241.20:8080
npm config set proxy http://16.7.241.20:8080
npm config set https-proxy http://16.7.241.20:8080
git config --global http.proxy http://16.7.241.20:8080

# 2) 사내 root CA 등록 — 프록시가 TLS 를 가로채므로 CA 신뢰 필수
sudo cp 사내rootCA.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
# Node(및 Prisma 엔진 다운로드)가 OS 신뢰 저장소를 보게 함
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# 3) Node 22.x — NodeSource 저장소 (프록시 환경변수가 sudo 로 전달되도록 -E)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

위 환경변수(`HTTP_PROXY` / `HTTPS_PROXY` / `NODE_EXTRA_CA_CERTS`)는 빌드·실행
세션에서도 유효해야 하므로 `~/.bashrc` 또는 서비스 환경파일에 박아둔다.

#### DB 준비 — 정상 환경 (psql 사용)
```bash
# postgres 슈퍼유저로 한 번만 실행
psql -U postgres -c "CREATE USER docspace WITH PASSWORD 'docspace';"
psql -U postgres -c "CREATE DATABASE docspace OWNER docspace;"
psql -U postgres -d docspace -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

#### DB 준비 — 사내 PC (psql.exe / pgAdmin4 차단 환경)
AhnLab EPS 등 사내 보안정책이 `psql.exe` 와 `pgAdmin4` 의 실행을 차단해도
**PostgreSQL 윈도우 서비스 자체가 살아 있고 5432 포트가 LISTENING이면**
앱은 정상 동작한다. 사용자 도구만 못 쓰는 것뿐이라 DB 생성과 확장 활성은
Node `pg` 드라이버로 우회할 수 있다.

```bash
# 임시 폴더 — 메인 프로젝트 트리 밖, 한 번만 쓰고 버린다
mkdir %TEMP%\pg-bootstrap && cd %TEMP%\pg-bootstrap
npm init -y
npm install pg

# Node 스크립트 한 줄 — postgres 슈퍼유저 비밀번호는 본인 환경 값으로
node -e "const {Client}=require('pg'); (async()=>{ \
  const a=new Client({host:'localhost',user:'postgres',password:'<PW>',database:'postgres'}); \
  await a.connect(); \
  await a.query(\"CREATE USER docspace WITH PASSWORD 'docspace'\").catch(()=>{}); \
  await a.query('CREATE DATABASE docspace OWNER docspace').catch(()=>{}); \
  await a.end(); \
  const b=new Client({host:'localhost',user:'postgres',password:'<PW>',database:'docspace'}); \
  await b.connect(); \
  await b.query('CREATE EXTENSION IF NOT EXISTS pg_trgm'); \
  await b.end(); \
  console.log('OK'); \
})();"
```

`CREATE USER` / `CREATE DATABASE` 가 이미 존재해도 `.catch(()=>{})` 로 흘려
넘기므로 멱등(재실행 안전). 끝나면 임시 폴더는 삭제해도 무방.

#### 환경 설정 + 마이그레이션 + 실행
```bash
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
- **3001** — NestJS API (Next.js가 프록시)
- **1234** — Hocuspocus WebSocket (브라우저가 직접 접속)

방화벽에 3000번과 1234번을 열어두면 LAN 사용자가 접속 가능. 3001번은
Next.js만 호출하므로 외부에 열 필요 없음.

#### API 포트 컨벤션 (Cycle 40)

API 포트는 두 곳에서 같은 값으로 설정해야 한다:

- `apps/api/.env` 의 **`PORT`** — NestJS가 실제로 listen
- `apps/web/.env` 의 **`API_PORT`** — Next.js가 프록시할 대상

두 값이 다르면 회원가입/로그인 시 503 또는 `ECONNREFUSED` 가 난다.
권장 기본값은 **3001** (`apps/api/src/main.ts` 와 `apps/web/next.config.mjs`
양쪽의 기본값과 일치). 특별한 이유 없으면 그대로 두는 게 안전.

#### nginx 리버스 프록시 (옵션 A — `/collab` path 로 WebSocket 분기)

단일 진입 포트(예: VM:80) 하나로 Next.js(3000)와 Hocuspocus(1234)를 함께
노출하는 패턴. HTTP 트래픽은 Next.js 로, `/collab` 로 시작하는 WebSocket
업그레이드 요청만 Hocuspocus 로 분기한다. (사내 VM 실배포에서 채택한 구성.
호스트 HAProxy 가 외부 `:8082` → `VM:80` 을 매핑.)

```nginx
server {
    listen 80;
    server_name _;

    # 협업 WebSocket — /collab → Hocuspocus :1234
    location /collab {
        proxy_pass http://127.0.0.1:1234/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;   # idle WS 끊김 방지
    }

    # 그 외 전부 → Next.js :3000
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

브라우저가 `/collab` 경로로 WS 에 붙도록 `apps/web/.env` 에 외부 노출 주소를
명시한다 (스킴은 외부 진입이 HTTPS 면 `wss://`):

```
# 외부 진입이 http://166.79.31.248:8082 인 경우
NEXT_PUBLIC_WS_URL="ws://166.79.31.248:8082/collab"
```

미설정 시엔 브라우저가 접속 호스트의 `:1234` 로 직접 붙으므로(기본 동작),
1234 포트를 외부에 따로 열어야 한다. 리버스 프록시 뒤에서는 위처럼 명시하는
편이 방화벽 표면이 작다.

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

## 3.5 컨테이너 개발 환경 (Cycle 42 — web + api + postgres + keycloak 풀스택)

`docker compose up` 한 번으로 **web(3000) / api(3001+1234) / postgres(5432) /
keycloak(8080)** 네 서비스를 모두 띄우는 개발용 풀스택. 위 3번이 postgres 등
인프라만 띄우는 것과 달리, 여기선 앱 이미지(api/web)까지 빌드해 컨테이너로
돌린다. AFS(K8s) 입주 + Keycloak SSO 전환(Cycle 43)을 위한 사전 포장 단계다.

> 이 단계(Cycle 42)는 "포장"만 한다 — 인증은 아직 기존 자체 JWT 그대로다.
> Keycloak 은 띄워두기만 하고 실제 로그인 연동은 Cycle 43.

### 구성 파일
- `apps/api/Dockerfile` — Node 22 멀티스테이지(build=bookworm, runtime=slim).
  기동 시 `prisma migrate deploy` 후 `node dist/src/main`.
- `apps/web/Dockerfile` — Next.js standalone. `next.config.mjs` 의
  `output:'standalone'` + `experimental.outputFileTracingRoot`(저장소 루트) 의존.
- 루트 `.dockerignore` — **두 이미지 모두 build context 가 저장소 루트**라 실제
  적용되는 건 이 루트 파일. (`apps/*/.dockerignore` 는 의도 문서용)
- `infra/keycloak/realm-docspace.json` — realm `docspace` + confidential client
  `docspace-web`(authorization code flow) + 테스트 사용자 `testuser`/`testpass`.

### 기동
```bash
# 저장소 루트에서
docker compose up -d --build

docker compose ps          # 4개 서비스 Up 확인
docker compose logs -f api # 마이그레이션/기동 로그
```

| 서비스 | 포트 | 용도 |
|---|---|---|
| web | 3000 | 사용자 접속 (Next.js standalone) |
| api | 3001 / 1234 | NestJS REST / Hocuspocus WS(브라우저 직접 접속) |
| postgres | 5432 | DB (볼륨 `docspace_pgdata` 영속) |
| keycloak | 8080 | 개발용 IdP. admin 콘솔 `/admin` (admin/admin) |

검증:
- 브라우저 `http://<host>:3000` → DocSpace 정상 동작(로그인은 **기존 자체 인증**
  그대로 — 동작이 바뀌면 안 됨).
- `http://<host>:8080/admin` (admin/admin) → realm `docspace` + client
  `docspace-web` 존재 확인.

### 빌드타임 주입 (중요한 함정)
Next.js 는 `rewrites()` 와 `NEXT_PUBLIC_*` 를 **빌드 시점에** 굳힌다. 런타임
ENV 로는 안 바뀐다. 그래서 web 이미지는 다음을 **빌드 ARG** 로 받는다
(`docker-compose.yml` 의 `web.build.args`):
- `API_HOST=api` — web 컨테이너가 api 컨테이너에 서비스명으로 닿게 함
  (`localhost` 면 자기 자신을 가리켜 실패). 포트는 `API_PORT` 컨벤션(3001) 유지.
- `NEXT_PUBLIC_WS_URL=ws://166.79.31.248:1234` — 브라우저가 직접 붙는
  Hocuspocus 주소. **VM 외부 접속 IP 기준**이라 환경이 바뀌면 이 값으로 재빌드.

> 비컨테이너(`npm run dev:all`)는 `API_HOST` 미설정 → 기본 `localhost` 라
> 기존 동작 그대로다. 포트 컨벤션(Cycle 40)은 컨테이너에서도 불변.

### 사내 프록시 환경에서 빌드 (중요 — EAI_AGAIN)
컨테이너 **빌드 단계의 `npm ci`** 는 npm 레지스트리에 직접 접속한다. Docker
이미지 pull 은 데몬이 프록시를 경유해 되더라도, **빌드/컨테이너 내부 npm 은
호스트 프록시를 자동으로 물려받지 않는다.** 사내망에서 그냥 빌드하면
`registry.npmjs.org` DNS 실패(`EAI_AGAIN`)가 나고, npm 10.x 가 이를
`Exit handler never called!` 라는 오해 소지 메시지로 표시한다.

→ 빌드 시 **프록시 + 사내 root CA** 를 주입해야 한다. Cycle 42 followup 에서
Dockerfile·compose 에 그 통로를 만들어 뒀다(값은 하드코딩하지 않고 빌드 환경에서 주입):

- **프록시**: `apps/{api,web}/Dockerfile` build 스테이지가 `ARG HTTP_PROXY/HTTPS_PROXY/NO_PROXY`
  를 선언(Docker predefined build arg → `npm ci` 등 RUN 에 자동 적용). `docker-compose.yml`
  의 두 서비스 `build.args` 가 빌드 호스트 환경변수(`${HTTP_PROXY}` 등)에서 받아 전달한다.
- **사내 root CA**: 저장소엔 `ca-certs/.gitkeep` 만 있고(실제 CA 는 `.gitignore` 로 비트래킹),
  build 스테이지가 `COPY ca-certs/` → `update-ca-certificates` → `NODE_EXTRA_CA_CERTS` 설정.
  `ca-certs/` 가 비어 있으면 빌드는 안 깨지고, **사내 CA(.crt)를 `ca-certs/` 에 넣으면 자동
  신뢰**된다. (node 는 시스템 CA 번들을 자동으로 안 보므로 `NODE_EXTRA_CA_CERTS` 필수.)

절차:
```bash
# 0) docker compose 플러그인 확인 — 없으면 설치
#    (Ubuntu 의 docker.io 패키지엔 Compose V2 가 포함돼 있지 않다)
docker compose version || sudo apt install -y docker-compose-v2 docker-buildx

# 1) 사내 root CA 를 빌드 컨텍스트에 배치 (repo 엔 안 올라간다)
mkdir -p ca-certs && cp /path/to/사내Proxy.crt ca-certs/

# 2) 프록시 환경변수 설정 (compose build.args 가 여기서 읽는다)
export HTTP_PROXY=http://16.7.241.20:8080
export HTTPS_PROXY=http://16.7.241.20:8080
export NO_PROXY=localhost,127.0.0.1

# 3) 빌드 (docker 에 sudo 가 필요한 환경이면 `sudo -E docker compose build`
#    — -E 로 위 프록시 env 를 빌드 프로세스까지 전달)
docker compose build api web
docker images | grep -i docspace   # api·web 이미지 확인
```
사내 IP/CA 는 환경 특정 값이라 저장소에 하드코딩하지 않는다. AFS 입주 시에도
같은 통로로 그 환경의 프록시/CA 만 주입하면 된다(코드 불변).

### Keycloak 메모 (Cycle 43 준비)
- `start-dev` 는 인메모리 H2 라 재시작 시 데이터 소실. `--import-realm` 이 매
  기동마다 `realm-docspace.json` 을 복구하므로 개발엔 충분(영속 필요 시 외부 DB).
- realm import 값: issuer `http://<host>:8080/realms/docspace`, client
  `docspace-web`, secret `dev-docspace-secret`. redirect URI 에 `localhost:3000`,
  `166.79.31.248:3000`, `166.79.31.248:8082`(HAProxy 경유) 등록.
- **issuer 호스트 주의**: 토큰 검증 주체(api)와 발급 요청 주체(브라우저)가 보는
  Keycloak 호스트가 달라 issuer 불일치가 날 수 있다(컨테이너 안 `keycloak:8080`
  vs 외부 `166.79.31.248:8080`). Cycle 43 에서 `KC_HOSTNAME` 등으로 정리.

---

## 3.6 VM Keycloak SSO 적용 (Cycle 43 — 실서버 166.79.31.248)

Cycle 43 의 Keycloak OIDC 로그인을 사내 VM 실서버에 적용한 절차. 외부 진입은
호스트 HAProxy 가 `:8082` → `VM:80(nginx)` 으로 매핑한다. 외부에서 보는 주소는
모두 `http://166.79.31.248:8082` 단일 오리진이고, nginx 가 경로로 분기한다
(`/` → Next.js, `/api` → NestJS, `/auth` → Keycloak).

> 핵심: 외부 단일 오리진(`:8082`) 뒤에 Keycloak 을 `/auth` 경로로 둔다.
> 그래서 issuer 도 `…:8082/auth/realms/docspace` 로, 브라우저·api·토큰이 모두
> 같은 주소를 본다(Cycle 43 의 issuer 일관성 원칙을 실서버에 적용).

### 1) Docker 설치
```bash
sudo apt install -y docker.io          # docker 29.1.3
```

### 2) Docker 데몬 프록시 (사내망)
```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/http-proxy.conf >/dev/null <<'EOF'
[Service]
Environment="HTTP_PROXY=http://16.7.241.20:8080"
Environment="HTTPS_PROXY=http://16.7.241.20:8080"
Environment="NO_PROXY=localhost,127.0.0.1"
EOF
```

### 3) containerd 서비스에도 동일 프록시 (중요)
Docker 29 는 **containerd 가 이미지를 pull** 한다. 데몬(dockerd) 프록시만으론
부족하고 containerd 에도 프록시를 줘야 image pull 이 된다(아래 트러블슈팅 참조).
```bash
sudo mkdir -p /etc/systemd/system/containerd.service.d
sudo tee /etc/systemd/system/containerd.service.d/http-proxy.conf >/dev/null <<'EOF'
[Service]
Environment="HTTP_PROXY=http://16.7.241.20:8080"
Environment="HTTPS_PROXY=http://16.7.241.20:8080"
Environment="NO_PROXY=localhost,127.0.0.1"
EOF
sudo systemctl daemon-reload
sudo systemctl restart containerd docker
```

### 4) Keycloak 컨테이너 기동
issuer 가 외부 단일 오리진의 `/auth` 경로를 보도록 `KC_HOSTNAME` 에 **경로까지**
포함한다. 리버스 프록시(nginx) 뒤이므로 `KC_PROXY_HEADERS=xforwarded`.
```bash
docker run -d --name docspace-keycloak -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -e KC_HOSTNAME=http://166.79.31.248:8082/auth \
  -e KC_HTTP_RELATIVE_PATH=/auth \
  -e KC_PROXY_HEADERS=xforwarded \
  -v ~/realm-docspace.json:/opt/keycloak/data/import/realm-docspace.json:ro \
  quay.io/keycloak/keycloak:26.3 start-dev --import-realm
```

### 5) nginx — `/auth` 분기 추가
`/etc/nginx/sites-available/docspace` 의 server 블록에 추가:
```nginx
location /auth/ {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
}
```
`sudo nginx -t && sudo systemctl reload nginx` 로 반영.

### 6) `apps/api/.env` — VM 기준 OIDC 값
모든 OIDC URL 이 외부 단일 오리진(`:8082`) + `/auth` 경로를 가리킨다.
```
KC_ISSUER_URI=http://166.79.31.248:8082/auth/realms/docspace
KC_CLIENT_ID=docspace-web
KC_CLIENT_SECRET=dev-docspace-secret
OIDC_REDIRECT_URI=http://166.79.31.248:8082/api/auth/oidc/callback
OIDC_POST_LOGIN_REDIRECT=/home
OIDC_POST_LOGOUT_REDIRECT=http://166.79.31.248:8082/login
```
> realm-docspace.json 의 client redirect URI / web origins / post-logout
> redirect 에 `http://166.79.31.248:8082/*` 가 포함돼 있어야 한다(이미 등록됨).

### 7) 재배포
```bash
./redeploy.sh        # DocSpace 를 Cycle 43 코드로 빌드·재기동
```

### 8) 검증 (완료)
외부 PC 브라우저 `http://166.79.31.248:8082` → "SSO 로그인" → Keycloak →
testuser/testpass → `/home` 진입 ✅. 로그아웃 → 재접속 시 재인증 요구(SLO) ✅.

---

## 3.7 컨테이너 풀스택 단독 운영 (Cycle 44 — compose nginx 가 :8082 직접 발행)

3.6 은 호스트 nginx + HAProxy(`:8082→:80`) 전제였다. Cycle 44 에서 운영을
**docker compose 풀스택 단독**으로 전환했다 — nohup 라이브 배포를 내리고
6개 컨테이너(web/api/keycloak/postgres/redis/nginx)만으로 돌린다. **compose 의
nginx 가 `8082:80` 을 직접 발행**하므로 host HAProxy 가 필요 없다(옛 HAProxy 가
inactive 였던 문제도 해소). 외부는 `http://<host>:8082` 단일 오리진, nginx 가
compose 네트워크 안에서 경로로 분기한다.

> 배포 도구는 저장소 `deploy/` 에 보존한다(Cycle 45 — 이전엔 VM-로컬만 존재).
> 환경 특정 값은 각 파일 상단/지정 위치에 모여 있어 다른 환경이면 그 블록만
> 고친다. 실제 `docker-compose.override.yml` 은 환경별이라 비커밋(`.gitignore`)
> — 저장소엔 `.example` 템플릿만 둔다.

### 구성 (`deploy/`)
- `deploy/docker-compose.override.example.yml` — nginx `8082:80` 발행 +
  `nginx-stack.conf` 마운트 + `depends_on`; keycloak `KC_HOSTNAME=…:8082/auth`
  (+`KC_HTTP_RELATIVE_PATH`/`KC_PROXY_HEADERS`); api OIDC 변수 `:8082/auth` 기준.
  **외부 접속 주소(`166.79.31.248:8082`)만 그 환경 주소로 치환.**
- `deploy/nginx-stack.conf` — compose 네트워크 경로 분기: `/`→web:3000,
  `/api`→api:3001(프리픽스 제거), `/auth`→keycloak:8080, `/collab`→api:1234(WS).
  override 가 `/etc/nginx/conf.d/default.conf` 로 마운트.
- `deploy/redeploy.sh` — git pull(auto-stash) → DB 백업 → 이미지 빌드 →
  `compose up -d` → 검증. **상단 환경 블록(`HTTP_PROXY`·`NEXT_PUBLIC_WS_URL`)만
  환경별로 수정.** `--no-build` 로 재빌드 생략(override/conf 만 바꿨을 때).

### 셋업·재배포
```bash
# 1) override 를 루트로 복사하고 외부 주소를 그 환경에 맞게 치환
cp deploy/docker-compose.override.example.yml docker-compose.override.yml
#    (KC_HOSTNAME / KC_ISSUER_URI / OIDC_* 의 호스트)

# 2) 사내 root CA 배치 (3.5 참조) + 재배포
#    (redeploy.sh 상단의 프록시/WS URL 값도 그 환경에 맞게 먼저 수정)
mkdir -p ca-certs && cp /path/to/사내Proxy.crt ca-certs/
./deploy/redeploy.sh            # 빌드 포함. override/conf 만 바꿨으면 --no-build
```
검증(Cycle 44): 6 컨테이너 Up, OIDC discovery issuer
`http://166.79.31.248:8082/auth/realms/docspace`, 외부 브라우저 E2E(SSO 로그인
→ 페이지 작성 → 실시간 협업 2탭 → 로그아웃 SLO) 통과.

> **DB 주의**: nohup(네이티브 PostgreSQL)에서 compose(컨테이너 postgres)로
> 전환하면 **DB 가 갈려 옛 데이터가 안 보인다**. 컨테이너 postgres 는 5432 를
> 점유하고 네이티브 클러스터는 down 된다. 데이터는 네이티브 쪽에 남아 있으니
> 아래 트러블슈팅의 복구 절차로 옮긴다.

---

## 4. 트러블슈팅

| 증상 | 원인/해결 |
|---|---|
| `connect ECONNREFUSED localhost:6379` 로 NestJS 부팅 실패 | `USE_REDIS=false` 로 두거나 Redis 서버 기동 |
| `pg_trgm extension does not exist` | DB에 `CREATE EXTENSION pg_trgm;` 1회 실행 |
| WebSocket 연결 실패(편집기에서 "오프라인" 배너) | 1234 포트 차단 여부 확인. `NEXT_PUBLIC_WS_URL=ws://<host>:1234` 로 명시 설정 가능 |
| Prisma engine 잠금 (Windows에서 nest watch 다중 기동) | 멈춘 `node` 프로세스 정리 후 `npx prisma generate` 재시도 |
| `psql.exe` / pgAdmin4 가 사내 보안 정책에 차단됨 | PostgreSQL 서비스가 살아 있고 5432가 LISTENING이면 앱 자체는 정상 동작. DB·확장 생성만 위 "사내 PC" 섹션의 Node `pg` 우회 스크립트로 처리 |
| `prisma migrate deploy` 중 `P3018` — `Page_content_trgm_idx` 인덱스가 존재하지 않음 | fresh DB 에서 발생*했었음* (그 인덱스를 만든 적이 없어 DROP 이 실패). **Cycle 41 에서 `20260511231747_add_comments/migration.sql` 의 두 DROP INDEX 를 `IF EXISTS` 로 바꿔 영구 fix** — fresh DB / 기존 DB 양쪽에서 멱등. 최신 코드를 받았다면 더는 발생하지 않으며 별도 회피 절차 불필요 |
| 회원가입/로그인 시 503 또는 `ECONNREFUSED ::1:<port>` | `apps/api/.env` 의 `PORT` 와 `apps/web/.env` 의 `API_PORT` 불일치 (Cycle 40). 둘을 같은 값(권장 3001)으로 맞추기. |
| 컨테이너 web 에서 `/api/*` 가 502/ECONNREFUSED | web 이미지가 `API_HOST=localhost` 로 빌드돼 자기 자신을 가리킴 (Cycle 42). compose 의 `web.build.args.API_HOST=api` 로 재빌드 (`docker compose build web`). rewrites 는 빌드타임에 굳으므로 ENV 변경만으론 안 됨 |
| keycloak 컨테이너 기동 실패 / 8080 포트 충돌 | 호스트 8080 사용 중인지 확인 (`ss -ltnp \| grep 8080`). 다른 서비스가 쓰면 compose 의 keycloak `ports` 를 `18080:8080` 등으로 변경 |
| `docker compose up` 중 keycloak realm 미반영 | `--import-realm` 은 **신규 realm 만** import. 같은 이름 realm 이 이미 있으면 건너뜀. start-dev 인메모리라 보통 매 기동 새로 import 되지만, 영속 볼륨을 붙였다면 realm 삭제 후 재기동 |
| (VM) Docker 이미지 pull `TLS handshake timeout` | Docker 29 는 **containerd 가 pull** 하므로 dockerd 프록시만으론 부족. `containerd.service.d/http-proxy.conf` 추가 후 `systemctl daemon-reload && systemctl restart containerd docker` (위 3.6-3 참조) |
| (VM) `quay.io` referrers `TLS handshake timeout` | 사내 프록시 경유 시 일시적. **재시도하면 통과**. (containerd 프록시는 정상 설정된 상태에서 발생하는 간헐 현상) |
| (VM) Keycloak issuer 에 `/auth` 누락 → OIDC discovery/iss 불일치 | `KC_HOSTNAME` 에 **경로(`/auth`)까지** 포함: `KC_HOSTNAME=http://166.79.31.248:8082/auth` + `KC_HTTP_RELATIVE_PATH=/auth`. 그래야 issuer 가 `…:8082/auth/realms/docspace` 로 떨어진다 |
| (VM) `git pull` 이 `Proxy CONNECT aborted` / `unexpected TLS packet` | 사내 프록시 일시 불안정. 회복 전까지 **git bundle 우회**: (로컬) `git bundle create docspace.bundle <branch>` → `scp` 로 VM 전송 → (VM) `git remote set-url origin <bundle경로>` → `git pull` → `./redeploy.sh` → 완료 후 `git remote set-url origin <원래 URL>` 복원 |
| `docker: unknown command: docker compose` | Ubuntu 의 docker.io 엔 Compose V2 미포함. `sudo apt install docker-compose-v2 docker-buildx` 설치 후 `docker compose version` 으로 확인 |
| (VM) `docker compose build` 가 base image metadata 단계에서 i/o timeout (직통 IP 로 dial) | embedded BuildKit 이 데몬 HTTP_PROXY 를 base image 해결에 안 쓴다. `docker pull <base image>`(예: `node:22-bookworm`)로 먼저 받아두면 — 이 경로는 containerd 프록시 경유라 정상 — BuildKit 이 로컬 이미지를 써서 우회된다 |
| (compose nginx) 앱 컨테이너 재빌드/재생성 후 `/api`·`/auth` 등이 502 | nginx 는 config 로드 시점에 upstream(`api`/`web`/`keycloak`) IP 를 1회 해석·캐시한다. `docker compose up -d --build` 로 앱 컨테이너만 새 IP 를 받으면 nginx 가 옛 IP 를 들고 502. **`docker compose restart nginx`(단독)** 로 upstream 재해석하면 해소. (정공법: nginx conf 에 `resolver 127.0.0.11` + 변수 `proxy_pass` 로 동적 해석) |
| (compose 전환) 옛 페이지·공간이 화면에서 사라짐 | nohup(네이티브 PostgreSQL 16, `/var/lib/postgresql/16/main`)→compose(컨테이너 `docspace_postgres`)로 전환하며 **DB 가 갈림**. 컨테이너 postgres 가 5432 점유 → 네이티브 클러스터 down. 복구: 네이티브 클러스터를 임시 `:5433` 으로 기동 → `pg_dump` → 컨테이너 DB drop/recreate → 덤프 복원 → api 재기동(entrypoint 의 `prisma migrate deploy` 자동). 백업 먼저 떠둘 것 |
