// Cycle L3 (feature/ldh) — 로컬 로그인 실패 잠금 기준 상수 + 헬퍼.
// 추후 환경변수화 여지를 남겨 한 곳에 모은다.
//   - 연속 5회 오답 → 15분 잠금.
// OIDC 로그인에는 적용하지 않는다(비번 검증은 Keycloak 담당).

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// 잠금 만료까지 남은 분(올림). 안내 메시지용. 이미 지났으면 0.
export function minutesUntil(lockedUntil: Date, now: Date): number {
  const diffMs = lockedUntil.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 60000);
}

// 지금 잠겨 있는지(만료 시각이 미래인지).
export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil != null && lockedUntil.getTime() > now.getTime();
}
