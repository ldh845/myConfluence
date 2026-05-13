"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth/useAuth";

// FR-001 (Cycle 27b) — 회원가입. 자동 로그인 + /home.

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

export default function SignupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) router.replace("/home");
  }, [user, isLoading, router]);

  const signup = useMutation<void, Error>({
    mutationFn: async () => {
      const r = await apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username, password, name, department }),
      });
      if (!r.ok) {
        if (r.status === 409) {
          throw new Error("이미 사용 중인 아이디입니다.");
        }
        if (r.status === 400) {
          throw new Error("입력 정보를 확인해주세요.");
        }
        throw new Error("회원가입에 실패했습니다.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace("/home");
    },
    onError: (err) => window.alert(err.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    if (username.length < 4 || username.length > 32) {
      setClientError("아이디는 4~32자여야 합니다.");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setClientError("아이디는 영문/숫자/언더스코어만 가능합니다.");
      return;
    }
    if (password.length < 8) {
      setClientError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setClientError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (!name.trim() || !department.trim()) {
      setClientError("이름과 소속을 입력해주세요.");
      return;
    }
    signup.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white border border-[#dfe1e6] rounded-md p-6 space-y-3"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold">
            M
          </div>
          <span className="text-[16px] font-semibold text-[#172b4d]">
            my<span className="text-[#0052cc]">Confluence</span>
          </span>
        </div>
        <h1 className="text-[20px] font-semibold text-[#172b4d]">회원가입</h1>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#42526e]">아이디</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="4~32자, 영문/숫자/_"
            autoComplete="username"
            className="mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#42526e]">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            autoComplete="new-password"
            className="mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#42526e]">비밀번호 확인</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#42526e]">이름</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#42526e]">소속</span>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="예: 플랫폼개발팀"
            className="mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]"
          />
        </label>

        {clientError && (
          <div className="text-[12px] text-[#de350b]">{clientError}</div>
        )}

        <button
          type="submit"
          disabled={signup.isPending}
          className="w-full py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba] disabled:cursor-not-allowed"
        >
          {signup.isPending ? "가입 중..." : "회원가입"}
        </button>

        <div className="text-center text-[12px] text-[#6b778c]">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-[#0052cc] hover:underline">
            로그인
          </Link>
        </div>

        <div className="text-[11px] text-[#6b778c] border-t border-[#dfe1e6] pt-3">
          회사 이메일이 아닌 사내 아이디로 가입하세요. 첫 가입자는 자동으로
          관리자가 됩니다.
        </div>
      </form>
    </div>
  );
}
