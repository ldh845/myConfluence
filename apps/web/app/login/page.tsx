"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";

// Cycle 43(2/2) — 로그인은 Keycloak OIDC(SSO) 단일.
// 아이디/비번 폼·회원가입 링크 제거. "SSO 로그인" 버튼은 GET /api/auth/oidc/login
// 으로 top-level 네비게이션(OIDC 리다이렉트 흐름이라 fetch 가 아니라 window.location).
// 이미 로그인된 상태(docspace_session)면 /home 으로 보낸다.

const HOME_PATH = "/home";

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) router.replace(HOME_PATH);
  }, [user, isLoading, router]);

  const startSso = () => {
    // OIDC authorization code 흐름 — 서버가 Keycloak 으로 302 리다이렉트한다.
    window.location.href = "/api/auth/oidc/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] p-6">
      <div className="w-full max-w-sm bg-white border border-[#dfe1e6] rounded-md p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold">
            D
          </div>
          <span className="text-[16px] font-semibold text-[#172b4d]">
            Doc<span className="text-[#0052cc]">Space</span>
          </span>
        </div>

        <h1 className="text-[20px] font-semibold text-[#172b4d]">로그인</h1>

        <p className="text-[13px] text-[#6b778c]">
          사내 계정(SSO)으로 로그인합니다.
        </p>

        <button
          type="button"
          onClick={startSso}
          className="w-full py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6]"
        >
          SSO 로그인
        </button>
      </div>
    </div>
  );
}
