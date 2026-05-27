import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

// Cycle 48 — RolesGuard 단위 검증.

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const makeCtx = (user?: { role?: string }): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  it('returns true when no roles metadata is set (route is unguarded by RolesGuard)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(undefined);
    expect(guard.canActivate(makeCtx({ role: 'DEVELOPER' }))).toBe(true);
  });

  it('returns true when user.role matches required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(guard.canActivate(makeCtx({ role: 'ADMIN' }))).toBe(true);
  });

  it('throws Forbidden when user.role is not in required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeCtx({ role: 'DEVELOPER' }))).toThrow(
      ForbiddenException,
    );
  });

  it('throws Forbidden when user has no role at all', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeCtx({}))).toThrow(ForbiddenException);
  });

  it('throws Forbidden when req.user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
