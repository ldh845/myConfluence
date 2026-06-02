// FR-001 (Cycle 27b) — auth용 fetch helper.
// httpOnly cookie는 same-origin에서 자동 전송되지만 credentials: 'include' 명시.
// JSON Content-Type 기본, 호출자가 override 가능.
// 기존 fetch 호출들은 그대로 두고 auth flow에서만 사용 (점진적 마이그레이션).

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });
}
