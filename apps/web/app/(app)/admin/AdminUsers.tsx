"use client";

import { useQuery } from "@tanstack/react-query";

// Cycle 48 — 관리자 사용자 목록. 읽기 전용 — Keycloak 이 계정 source.

type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
  department: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
};

const KC_ADMIN_URL =
  process.env.NEXT_PUBLIC_KC_ADMIN_URL ?? "http://localhost:8080/admin/";

export default function AdminUsers() {
  const { data, isLoading, error } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const r = await fetch("/api/admin/users", { credentials: "include" });
      if (!r.ok) throw new Error("사용자 목록 조회 실패");
      return (await r.json()) as AdminUser[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="bg-[#deebff] border border-[#b3d4ff] rounded-md p-4 text-[12px] text-[#172b4d]">
        <p className="font-semibold mb-1">
          계정 생성/활성화/역할 변경은{" "}
          <a
            href={KC_ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0052cc] underline hover:text-[#0747a6]"
          >
            Keycloak Admin 콘솔
          </a>
          에서 수행합니다.
        </p>
        <p className="text-[#42526e]">
          이 페이지는 읽기 전용입니다. 역할 변경은 Keycloak realm role
          <code className="mx-1 px-1 bg-white rounded text-[11px]">admin</code>
          부여/회수로 수행되며, 해당 사용자가 다음 로그인할 때 DocSpace 에
          반영됩니다.
        </p>
      </div>

      <div className="bg-white border border-[#dfe1e6] rounded-md overflow-hidden">
        {isLoading && (
          <div className="p-6 text-[13px] text-[#6b778c]">불러오는 중...</div>
        )}
        {error && (
          <div className="p-6 text-[13px] text-[#de350b]">
            {(error as Error).message}
          </div>
        )}
        {data && data.length === 0 && (
          <div className="p-6 text-[13px] text-[#6b778c]">사용자가 없습니다.</div>
        )}
        {data && data.length > 0 && (
          <table className="w-full text-[13px]">
            <thead className="bg-[#f4f5f7] text-[11px] uppercase text-[#6b778c]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">이메일</th>
                <th className="px-3 py-2 text-left font-semibold">이름</th>
                <th className="px-3 py-2 text-left font-semibold">역할</th>
                <th className="px-3 py-2 text-left font-semibold">활성화</th>
                <th className="px-3 py-2 text-left font-semibold">마지막 로그인</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-t border-[#dfe1e6]">
                  <td className="px-3 py-2 text-[#172b4d]">
                    {u.email ?? <span className="text-[#a5adba]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-[#172b4d]">
                    {u.name}
                    <span className="text-[11px] text-[#6b778c] ml-2">
                      @{u.username}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] ${
                        u.role === "ADMIN"
                          ? "bg-[#ffebe6] text-[#bf2600]"
                          : "bg-[#dfe1e6] text-[#42526e]"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {u.emailVerified ? (
                      <span className="text-[#36b37e]">✓ 활성</span>
                    ) : (
                      <span className="text-[#6b778c]">미인증</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[#42526e]">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : (
                      <span className="text-[#a5adba]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
