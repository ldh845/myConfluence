// Cycle L2 followup (feature/ldh) — 전역 401 추방 핸들러.
//
// 배경: 계정이 비활성화되면 서버(jwt.strategy)는 모든 API 를 401 로 막지만, 프론트엔드에
// 전역 401 처리가 없어 캐시된 셸/데이터가 그대로 보였다(미들웨어는 쿠키 "존재"만 확인하므로
// 비활성 사용자의 유효 쿠키는 통과). 보안상 데이터는 차단되지만 UX 가 "안 막힌 것"처럼 오해됨.
//
// 해결: 모든 fetch 응답을 한 곳에서 가로채(window.fetch 패치) /api 응답이 401 이면
// 세션 쿠키를 정리하고 /login 으로 하드 이동한다. 이 코드베이스는 공용 래퍼(apiFetch)보다
// raw fetch("/api/...") 사용이 압도적으로 많아(20 vs 3), 호출부마다 손대는 대신 단일
// 인터셉터로 모두 포괄하는 것이 가장 견고하다.
//
// followup 2 (bfcache): 추방 후 뒤로가기 시 브라우저 bfcache 가 직전 화면을 메모리에서
// 복원하면 서버/미들웨어/fetch 를 안 타므로 로그아웃 상태인데 이전 페이지가 잔상으로 보인다.
// 'pageshow' 의 event.persisted(=bfcache 복원)에서 /api/auth/me 로 세션을 1회 재검증 —
// 죽었으면 401 이 위 fetch 패치를 그대로 타고 추방된다(새 추방 로직 없이 기존 흐름 재사용).

const AUTH_EXEMPT_PREFIXES = [
  // 로그인 실패(잘못된 비번)의 401 이 추방으로 이어지면 안 된다.
  "/api/auth/login",
  // 추방 그 자체가 부르는 엔드포인트 — 재귀 방지.
  "/api/auth/clear-session",
  // 로그인 화면의 public 플래그 조회.
  "/api/auth/local-login-enabled",
];

/**
 * 401 응답이 "세션 추방"을 유발해야 하는지 판정하는 순수 함수.
 * - requestPath: 요청한 경로(예: "/api/pages"). 절대 URL 도 pathname 으로 환산해 전달.
 * - currentPathname: 현재 브라우저 경로(window.location.pathname).
 *
 * 추방 조건: /api 호출이면서, 인증 예외 경로가 아니고, 이미 /login 화면이 아닐 때.
 */
export function shouldEjectOn401(
  requestPath: string,
  currentPathname: string,
): boolean {
  if (!requestPath.startsWith("/api/")) return false;
  if (AUTH_EXEMPT_PREFIXES.some((p) => requestPath.startsWith(p))) return false;
  if (currentPathname.startsWith("/login")) return false;
  return true;
}

/**
 * bfcache 복원(pageshow) 시 세션을 재검증해야 하는지 판정하는 순수 함수.
 * - persisted: PageTransitionEvent.persisted (true 면 bfcache 에서 복원됨).
 * - currentPathname: 현재 브라우저 경로.
 *
 * 재검증 조건: bfcache 복원이면서 /login 화면이 아닐 때. 첫 로드(persisted=false)나
 * /login 에서는 불필요하다.
 */
export function shouldRevalidateOnPageShow(
  persisted: boolean,
  currentPathname: string,
): boolean {
  if (!persisted) return false;
  if (currentPathname.startsWith("/login")) return false;
  return true;
}

// fetch 인자(string | URL | Request)에서 pathname 만 안전하게 추출.
function toPathname(input: RequestInfo | URL): string {
  try {
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url; // Request
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return new URL(url).pathname;
    }
    // 상대 경로면 그대로 pathname 으로 본다(쿼리 제거).
    return url.split("?")[0];
  } catch {
    return "";
  }
}

// 중복 추방 방지(한 번 시작하면 네비게이션까지 다른 401 은 무시).
let ejecting = false;

function eject(originalFetch: typeof fetch): void {
  if (ejecting) return;
  ejecting = true;
  // httpOnly 쿠키라 서버에 정리를 요청한 뒤 하드 네비게이션으로 캐시 셸을 비운다.
  originalFetch("/api/auth/clear-session", {
    method: "POST",
    credentials: "include",
  })
    .catch(() => {
      /* 정리 실패해도 추방은 진행 */
    })
    .finally(() => {
      // followup 3 — href 대신 replace: 죽은 페이지 항목을 /login 으로 교체해
      // 히스토리에 추방 항목이 쌓이지 않게 한다(뒤로가기로 잔상 복귀 방지).
      window.location.replace("/login?error=session_expired");
    });
}

/**
 * window.fetch 를 1회만 패치해 전역 401 추방을 설치한다.
 * 클라이언트에서만 동작하며, 중복 설치를 가드한다.
 */
export function installSessionGuard(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { __dsSessionGuardInstalled?: boolean };
  if (w.__dsSessionGuardInstalled) return;
  w.__dsSessionGuardInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const res = await originalFetch(input, init);
    if (res.status === 401) {
      const path = toPathname(input);
      if (shouldEjectOn401(path, window.location.pathname)) {
        eject(originalFetch);
      }
    }
    return res;
  };

  // followup 2 — bfcache 복원 시 세션 재검증. 죽은 세션이면 /api/auth/me 가 401 →
  // 위 fetch 패치가 기존 추방 흐름(clear-session + /login)을 그대로 수행한다.
  window.addEventListener("pageshow", (event) => {
    const persisted = (event as PageTransitionEvent).persisted;
    if (!shouldRevalidateOnPageShow(persisted, window.location.pathname)) return;
    // bfcache 는 JS 힙째 동결한다 → 동결 시점의 ejecting=true 가 복원돼 추방을 막을 수
    // 있으므로 복원 시 리셋한다.
    ejecting = false;
    // 패치된 window.fetch 로 호출해야 401 이 인터셉터를 탄다(originalFetch 아님).
    void window.fetch("/api/auth/me", { credentials: "include" }).catch(() => {
      /* 네트워크 오류는 무시 — 살아있으면 200, 죽었으면 401 추방 */
    });
  });
}
