"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth/useAuth";

// FR-001 (Cycle 27b) — 로그인 페이지. 이미 로그인된 상태면 자동 /home.
// Cycle 32 — 로그인 후 항상 /home 으로. 이 시스템의 첫 화면은 /home.

const HOME_PATH = "/home";

function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!isLoading && user) router.replace(HOME_PATH);
  }, [user, isLoading, router]);

  const login = useMutation<void, Error>({
    mutationFn: async () => {
      const r = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        if (r.status === 401) {
          throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        throw new Error("로그인에 실패했습니다.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace(HOME_PATH);
    },
    onError: (err) => window.alert(err.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    login.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white border border-[#dfe1e6] rounded-md p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold">
            M
          </div>
          <span className="text-[16px] font-semibold text-[#172b4d]">
            my<span className="text-[#0052cc]">Confluence</span>
          </span>
        </div>

        <h1 className="text-[20px] font-semibold text-[#172b4d]">로그인</h1>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#42526e]">
            아이디
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            className="mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#42526e]">
            비밀번호
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
        </label>

        <button
          type="submit"
          disabled={login.isPending || !username.trim() || !password}
          className="w-full py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
        >
          {login.isPending ? "로그인 중..." : "로그인"}
        </button>

        <div className="text-center text-[12px] text-[#6b778c]">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-[#0052cc] hover:underline">
            회원가입
          </Link>
        </div>

        <div className="text-[11px] text-[#6b778c] border-t border-[#dfe1e6] pt-3">
          비밀번호 찾기는 이메일 시스템 도입 후 제공됩니다.
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[13px] text-[#6b778c]">로딩 중...</div>}>
      <LoginForm />
    </Suspense>
  );
}
