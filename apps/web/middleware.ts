import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// FR-001 (Cycle 27b) — 미인증 사용자를 /login으로 redirect.
// Cycle 43(2/2) — 자체 회원가입 제거로 /signup 공개 경로도 제거. /login(=SSO
// 버튼 페이지)과 /share/<token> 공유 페이지만 공개. 쿠키 존재 여부만 체크
// (서명 검증은 백엔드 /auth/me가 담당 — middleware에서 secret 접근 안 함).
//
// Cycle L2 followup 3 — 죽은 세션 페이지 잔상 근본 차단. 보호 라우트 응답에
// Cache-Control: no-store 를 붙여 인증 페이지가 bfcache/디스크 캐시에 저장되지 않게
// 한다. 효과: 추방 후 뒤로가기 연타가 항상 미들웨어를 타고, 쿠키가 없으면 무조건
// /login 으로 redirect → 비로그인 상태로 옛 내용이 복원되는 경로를 제거.
// 트레이드오프: 정상 사용자도 뒤로가기 시 bfcache 즉시 복원 대신 일반 로딩을 거친다
// (보안/정확성 우선). 공개 페이지(/login)·정적 자산(_next 등)은 적용 제외.
//
// Cycle L-AFS — K8s oauth2-proxy 무상태 모드 지원.
//   Ingress가 주입한 X-Auth-Request-* 헤더로 인증 판정 + API 프록시 요청에 전달.

const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_PREFIXES = ["/share/", "/api/", "/_next/", "/static/", "/icons/"];
const PUBLIC_FILES = new Set(["/favicon.ico"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (PUBLIC_FILES.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 인증 판정:
  //   - 상태ful: docspace_session 쿠키 존재
  //   - 무상태(K8s oauth2-proxy): X-Auth-Request-User 헤더 존재
  // 둘 중 하나라도 있으면 인증된 것으로 판단.
  const cookie = req.cookies.get("docspace_session");
  const oauth2User = req.headers.get("x-auth-request-user");
  if (!cookie && !oauth2User) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // K8s oauth2-proxy 무상태 모드: Ingress가 주입한 인증 헤더를
  // downstream(Next.js rewrites → API) 요청에도 전달.
  // Next.js rewrites(/api/* → API 서비스)는 서버 간 요청이므로
  // 브라우저→Ingress 헤더가 자동 전달되지 않는다.
  // NextResponse.next({ request }) 로 요청 헤더를 수정하면
  // rewrites가 해당 헤더를 포함하여 API로 프록시한다.
  const requestHeaders = new Headers(req.headers);
  if (oauth2User) {
    requestHeaders.set("x-auth-request-user", oauth2User);
    const preferredUsername = req.headers.get("x-auth-request-preferred-username");
    if (preferredUsername) {
      requestHeaders.set("x-auth-request-preferred-username", preferredUsername);
    }
    const userGroup = req.headers.get("x-auth-request-user-group");
    if (userGroup) {
      requestHeaders.set("x-auth-request-user-group", userGroup);
    }
  }

  // 인증된 보호 라우트 통과 — 캐시에 남기지 않는다(뒤로가기 잔상 차단).
  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
