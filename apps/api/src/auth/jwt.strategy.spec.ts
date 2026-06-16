import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService, AuthUser } from './auth.service';

// Cycle L2 (feature/ldh) — jwt.strategy.validate 가 비활성 계정을 차단하는지 검증.
// 유효한 JWT 가 남아 있어도 isActive=false 이면 401 → 기존 세션 즉시 차단.
// Cycle L4 (feature/ldh) — validate 가 role 을 토큰 payload 가 아닌 DB 값으로
//   채우는지 검증(역할 변경 시 재로그인 없이 즉시 반영의 근거).

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authMock: { findById: jest.Mock };

  const activeUser: AuthUser = {
    id: 'u1',
    username: 'alice',
    name: 'Alice',
    department: 'Eng',
    role: 'DEVELOPER',
    createdAt: new Date(),
    isActive: true,
    hasLocalPassword: false,
    showPersonalSpaceInSidebar: false,
  };

  beforeEach(() => {
    authMock = { findById: jest.fn() };
    const configMock = {
      get: (key: string, def?: string) => def ?? 'test-secret',
    } as unknown as ConfigService;
    strategy = new JwtStrategy(
      authMock as unknown as AuthService,
      configMock,
    );
  });

  const payload = { sub: 'u1', username: 'alice', role: 'DEVELOPER' };

  it('returns the user when active', async () => {
    authMock.findById.mockResolvedValue(activeUser);
    await expect(strategy.validate(payload)).resolves.toEqual(activeUser);
  });

  it('throws 401 when user not found', async () => {
    authMock.findById.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws 401 when account is deactivated', async () => {
    authMock.findById.mockResolvedValue({ ...activeUser, isActive: false });
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // Cycle L4 — payload.role 은 DEVELOPER 지만 DB(findById) 가 ADMIN 이면
  // validate 결과의 role 은 DB 값(ADMIN). 역할 변경이 재로그인 없이 즉시 반영됨을 보장.
  it('reflects the DB role, not the stale token payload role', async () => {
    authMock.findById.mockResolvedValue({ ...activeUser, role: 'ADMIN' });
    const result = await strategy.validate(payload); // payload.role === 'DEVELOPER'
    expect(result.role).toBe('ADMIN');
  });
});
