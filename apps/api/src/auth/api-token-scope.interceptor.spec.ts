import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ApiTokenScopeInterceptor } from './api-token-scope.interceptor';

// Cycle L-API-3 (feature/ldh) — 스코프 enforcement 단위 검증.
//   READ 토큰: GET/HEAD 통과, 쓰기(POST/PUT/PATCH/DELETE) 403.
//   READ_WRITE 토큰·쿠키 인증(authVia 없음)·non-http: 무조건 통과.

const interceptor = new ApiTokenScopeInterceptor();

const ctx = (
  req: Record<string, unknown>,
  type: 'http' | 'ws' = 'http',
): ExecutionContext =>
  ({
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

const next = () => ({ handle: jest.fn().mockReturnValue('HANDLED') });

const run = (req: Record<string, unknown>, type: 'http' | 'ws' = 'http') => {
  const n = next();
  const res = interceptor.intercept(ctx(req, type), n as never);
  return { res, handle: n.handle };
};

describe('ApiTokenScopeInterceptor — READ 토큰', () => {
  it('GET 은 통과', () => {
    const { res, handle } = run({
      authVia: 'api-token',
      tokenScope: 'READ',
      method: 'GET',
    });
    expect(handle).toHaveBeenCalled();
    expect(res).toBe('HANDLED');
  });

  it('HEAD 는 통과', () => {
    const { handle } = run({
      authVia: 'api-token',
      tokenScope: 'READ',
      method: 'HEAD',
    });
    expect(handle).toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s 는 403', (method) => {
    const n = next();
    expect(() =>
      interceptor.intercept(
        ctx({ authVia: 'api-token', tokenScope: 'READ', method }),
        n as never,
      ),
    ).toThrow(ForbiddenException);
    expect(n.handle).not.toHaveBeenCalled();
  });
});

describe('ApiTokenScopeInterceptor — 통과 경로', () => {
  it('READ_WRITE 토큰은 쓰기도 통과(권한은 주인 가드가 최종 판정)', () => {
    const { handle } = run({
      authVia: 'api-token',
      tokenScope: 'READ_WRITE',
      method: 'POST',
    });
    expect(handle).toHaveBeenCalled();
  });

  it('쿠키 인증(authVia 없음)은 스코프 무관 통과', () => {
    const { handle } = run({ method: 'DELETE' });
    expect(handle).toHaveBeenCalled();
  });

  it('authVia=cookie 명시도 통과', () => {
    const { handle } = run({ authVia: 'cookie', method: 'POST' });
    expect(handle).toHaveBeenCalled();
  });

  it('non-http 컨텍스트는 관여하지 않음', () => {
    const { handle } = run(
      { authVia: 'api-token', tokenScope: 'READ', method: 'POST' },
      'ws',
    );
    expect(handle).toHaveBeenCalled();
  });
});
