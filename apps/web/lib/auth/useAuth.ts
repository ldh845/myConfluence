"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// FR-001 (Cycle 27b) — 인증 사용자 hook.
// /api/auth/me 호출, 401이면 null. staleTime 60s.

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  department: string;
  role: "ADMIN" | "PART_LEADER" | "DEVELOPER" | "DESIGNER" | "PM";
  createdAt: string;
};

export function useAuth() {
  const queryClient = useQueryClient();
  const query = useQuery<AuthUser | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const r = await apiFetch("/api/auth/me");
      if (r.status === 401) return null;
      if (!r.ok) throw new Error("auth check failed");
      const body = (await r.json()) as { user: AuthUser };
      return body.user;
    },
    retry: false,
    staleTime: 60_000,
  });

  // === [DEV ONLY] 화면 테스트용 ADMIN 강제 우회 ===
  // 운영 빌드(NODE_ENV !== "development")에서는 forceAdmin이 항상 false →
  // tree-shaking으로 if 블록 자체가 빌드 결과물에서 제거된다.
  // 활성화: apps/web/.env.local 에 NEXT_PUBLIC_DEV_FORCE_ADMIN=true 추가.
  // 백엔드 RolesGuard 는 진짜 토큰의 role 을 그대로 검증하므로 보안 우회 아님.
  const forceAdmin =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEV_FORCE_ADMIN === "true";
  const patchedUser = query.data
    ? { ...query.data, role: forceAdmin ? ("ADMIN" as const) : query.data.role }
    : null;

  return {
    user: patchedUser,
    isLoading: query.isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  };
}
