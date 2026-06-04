import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService, AuthUser } from './auth.service';

// Cycle L2 (feature/ldh) — jwt.strategy.validate 가 비활성 계정을 차단하는지 검증.
// 유효한 JWT 가 남아 있어도 isActive=false 이면 401 → 기존 세션 즉시 차단.

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
});
