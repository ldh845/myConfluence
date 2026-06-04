import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// Cycle L2 followup (feature/ldh) — clear-session 쿠키 제거 + 로컬 로그인 게이트 검증.

describe('AuthController', () => {
  let controller: AuthController;
  let authMock: { localLogin: jest.Mock };
  let configValues: Record<string, string>;

  const makeController = (overrides: Record<string, string> = {}) => {
    configValues = {
      COOKIE_NAME: 'docspace_session',
      LOCAL_LOGIN_ENABLED: 'false',
      ...overrides,
    };
    const configMock = {
      get: (key: string, def?: string) => configValues[key] ?? def,
    } as unknown as ConfigService;
    authMock = { localLogin: jest.fn() };
    return new AuthController(authMock as unknown as AuthService, configMock);
  };

  // clearCookie 호출을 기록하는 가짜 Response.
  const makeRes = () => {
    const cleared: Array<{ name: string; options: unknown }> = [];
    const res = {
      clearCookie: (name: string, options: unknown) => {
        cleared.push({ name, options });
        return res;
      },
      cookie: jest.fn(),
    } as unknown as Response;
    return { res, cleared };
  };

  describe('clearSession', () => {
    it('clears the session cookie and oidc id_token cookie', () => {
      controller = makeController();
      const { res, cleared } = makeRes();

      const result = controller.clearSession(res);

      expect(result).toEqual({ ok: true });
      const names = cleared.map((c) => c.name);
      expect(names).toContain('docspace_session');
      expect(names).toContain('oidc_id_token');
      // path '/' 로 지워야 발급 시 path 와 매칭된다.
      cleared.forEach((c) =>
        expect(c.options).toMatchObject({ path: '/' }),
      );
    });

    it('honors a custom COOKIE_NAME', () => {
      controller = makeController({ COOKIE_NAME: 'custom_session' });
      const { res, cleared } = makeRes();
      controller.clearSession(res);
      expect(cleared.map((c) => c.name)).toContain('custom_session');
    });
  });

  describe('login gate', () => {
    it('throws 403 when LOCAL_LOGIN_ENABLED is not "true"', async () => {
      controller = makeController({ LOCAL_LOGIN_ENABLED: 'false' });
      const { res } = makeRes();
      await expect(
        controller.login({ username: 'a', password: 'b' }, res),
      ).rejects.toThrow(ForbiddenException);
      expect(authMock.localLogin).not.toHaveBeenCalled();
    });

    it('sets cookie and returns user when enabled and credentials valid', async () => {
      controller = makeController({ LOCAL_LOGIN_ENABLED: 'true' });
      const { res } = makeRes();
      authMock.localLogin.mockResolvedValue({
        user: { id: 'u1', username: 'a' },
        token: 'tok',
      });
      const result = await controller.login(
        { username: 'a', password: 'b' },
        res,
      );
      expect(result).toEqual({ user: { id: 'u1', username: 'a' } });
      expect(res.cookie).toHaveBeenCalledWith(
        'docspace_session',
        'tok',
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
    });
  });
});
