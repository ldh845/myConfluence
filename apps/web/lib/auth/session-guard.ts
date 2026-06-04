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
      window.location.href = "/login?error=session_expired";
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
}
