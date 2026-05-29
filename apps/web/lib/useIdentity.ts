"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { getIdentity, type Identity } from "@/lib/userIdentity";

// Cycle 72 — 로그인 사용자의 실제 이름/id 를 프레즌스(협업 커서)·authorName 에 사용.
//   기존 getIdentity() 는 localStorage 의 랜덤 익명 이름("부지런한 다람쥐-xxx")을
//   썼는데, Keycloak 인증 도입 후엔 실명이 있으므로 그걸 우선한다.
//   비로그인/로딩/SSR 에서만 익명 폴백.

// 같은 사용자는 항상 같은 프레즌스 색을 갖도록 id 해시 → hue.
function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${h} 70% 45%)`;
}

export function useIdentity(): Identity {
  const { user } = useAuth();
  return useMemo<Identity>(
    () =>
      user
        ? { id: user.id, name: user.name, color: colorForId(user.id) }
        : getIdentity(),
    [user],
  );
}
