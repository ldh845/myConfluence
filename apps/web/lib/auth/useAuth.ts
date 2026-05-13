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

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  };
}
