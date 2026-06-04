"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { apiFetch } from "@/lib/api";

// Cycle 43(2/2) — 로그인은 Keycloak OIDC(SSO) 단일이었음.
// Cycle L1 (feature/ldh) — 하이브리드 인증: SSO 버튼은 그대로 두고, 서버 플래그
// LOCAL_LOGIN_ENABLED 가 켜진 경우에 한해 그 아래 ID/PW 로컬 로그인 폼을 노출한다.
//  - 플래그 조회: GET /api/auth/local-login-enabled (public)
//  - 제출: POST /api/auth/login → 성공 시 docspace_session 쿠키 발급 → /home
// 이미 로그인된 상태(docspace_session)면 /home 으로 보낸다.

const HOME_PATH = "/home";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  const [localEnabled, setLocalEnabled] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Cycle L2 (feature/ldh) — OIDC 콜백이 비활성 계정을 거부하면
  // /login?error=account_disabled 로 돌려보낸다. 안내 메시지로 표시.
  // Cycle L2 followup — 전역 401 추방 시 /login?error=session_expired 로 진입.
  const errorCode = searchParams.get("error");
  const accountDisabled = errorCode === "account_disabled";
  const sessionExpired = errorCode === "session_expired";

  useEffect(() => {
    if (!isLoading && user) router.replace(HOME_PATH);
  }, [user, isLoading, router]);

  // 로컬 로그인 플래그 조회 — 꺼져 있으면(기본) 폼을 아예 그리지 않는다.
  useEffect(() => {
    let active = true;
    apiFetch("/api/auth/local-login-enabled")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((body: { enabled?: boolean }) => {
        if (active) setLocalEnabled(Boolean(body.enabled));
      })
      .catch(() => {
        if (active) setLocalEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const startSso = () => {
    // OIDC authorization code 흐름 — 서버가 Keycloak 으로 302 리다이렉트한다.
    window.location.href = "/api/auth/oidc/login";
  };

  const submitLocal = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (r.ok) {
        // 쿠키가 막 발급됐으므로 전체 리로드로 세션을 새로 읽어 /home 으로.
        window.location.href = HOME_PATH;
        return;
      }
      if (r.status === 400) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        setError(
          body.message ??
            "이 계정은 SSO 전용입니다. 관리자에게 문의하세요.",
        );
      } else if (r.status === 401) {
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      } else if (r.status === 403) {
        setError("로컬 로그인이 비활성화되어 있습니다.");
      } else if (r.status === 423) {
        // Cycle L3 — 로그인 실패 잠금. 서버가 남은 분을 안내 메시지로 준다.
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        setError(
          body.message ??
            "로그인 시도가 많아 계정이 잠겼습니다. 잠시 후 다시 시도하세요.",
        );
      } else {
        setError("로그인에 실패했습니다. 잠시 후 다시 시도하세요.");
      }
    } catch {
      setError("로그인 요청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
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

        {accountDisabled && (
          <p className="text-[12px] text-[#de350b] bg-[#ffebe6] border border-[#ffbdad] rounded px-3 py-2">
            비활성화된 계정입니다. 관리자에게 문의하세요.
          </p>
        )}

        {sessionExpired && (
          <p className="text-[12px] text-[#de350b] bg-[#ffebe6] border border-[#ffbdad] rounded px-3 py-2">
            세션이 만료되었거나 계정이 비활성화되었습니다. 다시 로그인해 주세요.
          </p>
        )}

        <button
          type="button"
          onClick={startSso}
          className="w-full py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6]"
        >
          SSO 로그인
        </button>

        {localEnabled && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-[#dfe1e6]" />
              <span className="text-[12px] text-[#6b778c]">또는</span>
              <div className="flex-1 h-px bg-[#dfe1e6]" />
            </div>

            <form onSubmit={submitLocal} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="username"
                  className="text-[12px] text-[#6b778c]"
                >
                  아이디
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="password"
                  className="text-[12px] text-[#6b778c]"
                >
                  비밀번호
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
                />
              </div>

              {error && (
                <p className="text-[12px] text-[#de350b]">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 text-[13px] rounded border border-[#0052cc] text-[#0052cc] hover:bg-[#f4f8ff] disabled:opacity-50"
              >
                {submitting ? "로그인 중…" : "로컬 계정으로 로그인"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// useSearchParams 는 Suspense 경계 안에서 호출되어야 한다(Next 14 권장 패턴).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
