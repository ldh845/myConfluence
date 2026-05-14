import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// FR-001 (Cycle 27b) — 미인증 사용자를 /login으로 redirect.
// /share/<token> 공유 페이지와 /login /signup은 공개. 쿠키 존재 여부만 체크
// (서명 검증은 백엔드 /auth/me가 담당 — middleware에서 secret 접근 안 함).

const PUBLIC_PATHS = new Set(["/login", "/signup"]);
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
