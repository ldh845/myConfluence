"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { installSessionGuard } from "@/lib/auth/session-guard";

// Cycle 4 보일러플레이트. 기존 fetch 호출은 점진 마이그레이션 예정.
// Cycle L2 followup — 전역 401 추방 핸들러를 1회 설치(window.fetch 패치).
//   QueryClient 생성 시점(클라이언트 최초 렌더)에 동기 설치한다. installSessionGuard
//   내부가 typeof window 가드 + 중복 설치 가드를 가진다.
export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    installSessionGuard();
    return new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          staleTime: 30_000,
        },
      },
    });
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
