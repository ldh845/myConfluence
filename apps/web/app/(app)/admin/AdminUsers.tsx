"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/useAuth";

// Cycle 48 — 관리자 사용자 목록.
// Cycle L2 (feature/ldh) — 하이브리드 인증 계정 관리:
//   · "+ 로컬 계정 생성" 다이얼로그 → POST /api/admin/users
//   · 계정 유형 배지(SSO/로컬/혼합) + 활성 토글(PATCH /api/admin/users/:id/active)
//   · "비밀번호 설정/초기화" 다이얼로그(PATCH /api/admin/users/:id/local-password, L1 잔여분)
// Cycle L3 (feature/ldh) — 로그인 실패 잠금 배지 + "잠금 해제"(PATCH .../unlock) +
//   생성/비번 설정 다이얼로그에 비밀번호 정책 힌트.
// SSO 계정의 생성/역할은 여전히 Keycloak 이 source — 안내 배너로 병기.

const PASSWORD_HINT = "8자 이상, 영문과 숫자를 각각 1자 이상 포함";

type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
  department: string;
  role: string;
  isActive: boolean;
  hasLocalPassword: boolean;
  isSso: boolean;
  // Cycle L3 — 로그인 실패 잠금 상태.
  locked: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

const KC_ADMIN_URL =
  process.env.NEXT_PUBLIC_KC_ADMIN_URL ?? "http://localhost:8080/admin/";

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const { data, isLoading, error } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const r = await fetch("/api/admin/users", { credentials: "include" });
      if (!r.ok) throw new Error("사용자 목록 조회 실패");
      return (await r.json()) as AdminUser[];
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  // 비밀번호 설정/초기화 대상 사용자 (null = 닫힘).
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const setActive = useMutation<void, Error, { id: string; isActive: boolean }>(
    {
      mutationFn: async ({ id, isActive }) => {
        const r = await fetch(`/api/admin/users/${id}/active`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        });
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(body.message ?? "상태 변경 실패");
        }
      },
      onSuccess: refresh,
      onError: (err) => window.alert(err.message),
    },
  );

  // Cycle L3 — 로그인 실패 잠금 해제.
  const unlock = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const r = await fetch(`/api/admin/users/${id}/unlock`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "잠금 해제 실패");
      }
    },
    onSuccess: refresh,
    onError: (err) => window.alert(err.message),
  });

  // Cycle L4 — 로컬 전용 계정 역할 변경(ADMIN/DEVELOPER).
  const setRole = useMutation<void, Error, { id: string; role: string }>({
    mutationFn: async ({ id, role }) => {
      const r = await fetch(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "역할 변경 실패");
      }
    },
    onSuccess: refresh,
    onError: (err) => window.alert(err.message),
  });

  // Cycle 89 — 로컬 전용 계정 삭제.
  const deleteUser = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const r = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "삭제 실패");
      }
    },
    onSuccess: refresh,
    onError: (err) => window.alert(err.message),
  });

  const handleDelete = (u: AdminUser) => {
    if (
      !window.confirm(
        `'${u.name}(@${u.username})' 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
      )
    )
      return;
    deleteUser.mutate(u.id);
  };

  const changeRole = (u: AdminUser, role: string) => {
    if (role === u.role) return;
    // ADMIN 승격은 권한이 큰 변경이라 확인을 받는다.
    if (
      role === "ADMIN" &&
      !window.confirm(
        `'${u.name}(@${u.username})' 계정을 ADMIN 으로 승격하시겠습니까?\nADMIN 은 사용자 관리 등 모든 관리자 기능에 접근할 수 있습니다.`,
      )
    )
      return;
    setRole.mutate({ id: u.id, role });
  };

  const toggleActive = (u: AdminUser) => {
    if (u.isActive) {
      if (
        !window.confirm(
          `'${u.name}(@${u.username})' 계정을 비활성화하시겠습니까?\n비활성화 시 즉시 로그아웃되며 로그인이 차단됩니다.`,
        )
      )
        return;
    }
    setActive.mutate({ id: u.id, isActive: !u.isActive });
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#deebff] border border-[#b3d4ff] rounded-md p-4 text-[12px] text-[#172b4d]">
        <p className="font-semibold mb-1">하이브리드 인증 계정 관리</p>
        <p className="text-[#42526e]">
          SSO 계정의 생성·역할 변경은{" "}
          <a
            href={KC_ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0052cc] underline hover:text-[#0747a6]"
          >
            Keycloak Admin 콘솔
          </a>
          에서 수행합니다. 로컬 전용 계정 발급·비밀번호 설정·활성/비활성은 이
          페이지에서 처리합니다.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-3 py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6]"
        >
          + 로컬 계정 생성
        </button>
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
                <th className="px-3 py-2 text-left font-semibold">이름</th>
                <th className="px-3 py-2 text-left font-semibold">유형</th>
                <th className="px-3 py-2 text-left font-semibold">역할</th>
                <th className="px-3 py-2 text-left font-semibold">상태</th>
                <th className="px-3 py-2 text-left font-semibold">마지막 로그인</th>
                <th className="px-3 py-2 text-right font-semibold">관리</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-t border-[#dfe1e6]">
                  <td className="px-3 py-2 text-[#172b4d]">
                    {u.name}
                    <span className="text-[11px] text-[#6b778c] ml-2">
                      @{u.username}
                    </span>
                    {u.email && (
                      <span className="block text-[11px] text-[#6b778c]">
                        {u.email}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <AccountTypeBadge
                      isSso={u.isSso}
                      hasLocalPassword={u.hasLocalPassword}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {/* Cycle L4 — 로컬 전용 계정만 역할 변경 가능. SSO/혼합은
                        Keycloak 이 source(다음 로그인 때 원복)라 비활성 + 안내.
                        자기 자신 행도 비활성(셀프 권한 박탈 방지). */}
                    {u.isSso ? (
                      <div className="flex items-center gap-1.5">
                        <RoleBadge role={u.role} />
                        <span
                          className="text-[10px] text-[#6b778c]"
                          title="SSO 계정의 역할은 Keycloak 에서 관리됩니다"
                        >
                          Keycloak 관리
                        </span>
                      </div>
                    ) : me?.id === u.id ? (
                      <span title="자기 자신의 역할은 변경할 수 없습니다">
                        <RoleBadge role={u.role} />
                      </span>
                    ) : (
                      <select
                        value={u.role === "ADMIN" ? "ADMIN" : "DEVELOPER"}
                        onChange={(e) => changeRole(u, e.target.value)}
                        disabled={setRole.isPending}
                        className="px-2 py-1 text-[12px] border border-[#dfe1e6] rounded bg-white text-[#42526e] focus:outline-none focus:border-[#0052cc] disabled:opacity-40"
                      >
                        <option value="DEVELOPER">DEVELOPER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {u.isActive ? (
                        <span className="text-[#36b37e] text-[12px]">
                          ● 활성
                        </span>
                      ) : (
                        <span className="text-[#de350b] text-[12px]">
                          ● 비활성
                        </span>
                      )}
                      {/* Cycle L3 — 로그인 실패 잠금 배지. */}
                      {u.locked && (
                        <span
                          title={
                            u.lockedUntil
                              ? `${formatDate(u.lockedUntil)} 까지`
                              : undefined
                          }
                          className="px-1.5 py-0.5 rounded text-[10px] bg-[#fffae6] text-[#974f0c] border border-[#ffe380]"
                        >
                          🔒 잠김
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[#42526e]">
                    {u.lastLoginAt ? (
                      formatDate(u.lastLoginAt)
                    ) : (
                      <span className="text-[#a5adba]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      {/* Cycle L3 — 잠긴 계정만 잠금 해제 노출. */}
                      {u.locked && (
                        <button
                          type="button"
                          onClick={() => unlock.mutate(u.id)}
                          disabled={unlock.isPending}
                          className="px-2 py-1 text-[12px] rounded border border-[#ffe380] text-[#974f0c] hover:bg-[#fffae6] disabled:opacity-40"
                        >
                          잠금 해제
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPwTarget(u)}
                        className="px-2 py-1 text-[12px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#f4f5f7]"
                      >
                        {u.hasLocalPassword ? "비번 초기화" : "비번 설정"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        disabled={me?.id === u.id || setActive.isPending}
                        title={
                          me?.id === u.id
                            ? "자기 자신은 비활성화할 수 없습니다"
                            : undefined
                        }
                        className={`px-2 py-1 text-[12px] rounded border disabled:opacity-40 disabled:cursor-not-allowed ${
                          u.isActive
                            ? "border-[#ffbdad] text-[#bf2600] hover:bg-[#ffebe6]"
                            : "border-[#abf5d1] text-[#006644] hover:bg-[#e3fcef]"
                        }`}
                      >
                        {u.isActive ? "비활성화" : "활성화"}
                      </button>
                      {!u.isSso && (
                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          disabled={deleteUser.isPending}
                          className="px-2 py-1 text-[12px] rounded border border-[#dfe1e6] text-[#6b778c] hover:bg-[#ffebe6] hover:text-[#de350b] hover:border-[#ffbdad] disabled:opacity-40"
                          title="로컬 계정만 삭제 가능"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateLocalUserDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}
      {pwTarget && (
        <SetPasswordDialog
          target={pwTarget}
          onClose={() => setPwTarget(null)}
          onDone={() => {
            setPwTarget(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// Cycle L4 — 역할 배지(SSO/자기 자신 행처럼 변경 불가일 때 표시).
function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] ${
        role === "ADMIN"
          ? "bg-[#ffebe6] text-[#bf2600]"
          : "bg-[#dfe1e6] text-[#42526e]"
      }`}
    >
      {role}
    </span>
  );
}

function AccountTypeBadge({
  isSso,
  hasLocalPassword,
}: {
  isSso: boolean;
  hasLocalPassword: boolean;
}) {
  let label = "—";
  let cls = "bg-[#dfe1e6] text-[#42526e]";
  if (isSso && hasLocalPassword) {
    label = "혼합";
    cls = "bg-[#eae6ff] text-[#5243aa]";
  } else if (isSso) {
    label = "SSO";
    cls = "bg-[#deebff] text-[#0747a6]";
  } else if (hasLocalPassword) {
    label = "로컬";
    cls = "bg-[#e3fcef] text-[#006644]";
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] ${cls}`}>{label}</span>
  );
}

function CreateLocalUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation<void, Error>({
    mutationFn: async () => {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          name,
          department,
          email: email.trim() === "" ? undefined : email.trim(),
          password,
        }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        if (r.status === 409) throw new Error(body.message ?? "이미 사용 중인 아이디입니다.");
        throw new Error(body.message ?? "계정 생성 실패");
      }
    },
    onSuccess: onCreated,
    onError: (e) => setErr(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    create.mutate();
  };

  return (
    <Modal title="로컬 계정 생성" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="아이디" required>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={150}
            autoComplete="off"
            className={inputCls}
          />
        </Field>
        <Field label="이름" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={150}
            className={inputCls}
          />
        </Field>
        <Field label="부서" required>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
            maxLength={150}
            className={inputCls}
          />
        </Field>
        <Field label="이메일 (선택)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            className={inputCls}
          />
        </Field>
        <Field label="초기 비밀번호" required>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            className={inputCls}
          />
          <span className="block mt-1 text-[11px] text-[#6b778c]">
            {PASSWORD_HINT}
          </span>
        </Field>
        {err && <p className="text-[12px] text-[#de350b]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-[13px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#f4f5f7]"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="px-3 py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
          >
            {create.isPending ? "생성 중..." : "생성"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SetPasswordDialog({
  target,
  onClose,
  onDone,
}: {
  target: AdminUser;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation<void, Error>({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/users/${target.id}/local-password`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "비밀번호 설정 실패");
      }
    },
    onSuccess: onDone,
    onError: (e) => setErr(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    save.mutate();
  };

  return (
    <Modal
      title={`${target.hasLocalPassword ? "비밀번호 초기화" : "비밀번호 설정"} — ${target.name}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <p className="text-[12px] text-[#6b778c]">
          @{target.username} 계정의 로컬 로그인 비밀번호를{" "}
          {target.hasLocalPassword ? "초기화" : "설정"}합니다.
        </p>
        <Field label="새 비밀번호" required>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            className={inputCls}
          />
          <span className="block mt-1 text-[11px] text-[#6b778c]">
            {PASSWORD_HINT}
          </span>
        </Field>
        {err && <p className="text-[12px] text-[#de350b]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-[13px] rounded border border-[#dfe1e6] text-[#42526e] hover:bg-[#f4f5f7]"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="px-3 py-2 text-[13px] rounded bg-[#0052cc] text-white hover:bg-[#0747a6] disabled:bg-[#a5adba]"
          >
            {save.isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full px-3 py-2 text-[13px] border border-[#dfe1e6] rounded focus:outline-none focus:border-[#0052cc]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-[#42526e]">
        {label}
        {required && <span className="text-[#de350b] ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-md border border-[#dfe1e6] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold text-[#172b4d] mb-4">
          {title}
        </h3>
        {children}
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
