import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// FR-001 (Cycle 27b) — 미인증 사용자를 /login으로 redirect.
// Cycle 43(2/2) — 자체 회원가입 제거로 /signup 공개 경로도 제거. /login(=SSO
// 버튼 페이지)과 /share/<token> 공유 페이지만 공개. 쿠키 존재 여부만 체크
// (서명 검증은 백엔드 /auth/me가 담당 — middleware에서 secret 접근 안 함).

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

  const cookie = req.cookies.get("docspace_session");
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
