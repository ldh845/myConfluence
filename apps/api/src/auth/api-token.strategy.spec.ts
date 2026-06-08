import { ApiTokenStrategy } from './api-token.strategy';

// Cycle L-API-1 (feature/ldh) — Bearer 전략 단위 검증.
//   헤더 없음/잘못된 스킴 → fail(다음 전략/익명으로). 유효 → success(user).
//   서비스가 null → fail. 서비스가 throw → error(내부 오류).

type Req = { headers: Record<string, string | undefined> };

const make = (authResult: unknown, opts?: { throws?: boolean }) => {
  const authenticateToken = opts?.throws
    ? jest.fn().mockRejectedValue(new Error('db down'))
    : jest.fn().mockResolvedValue(authResult);
  const s = new ApiTokenStrategy({ authenticateToken } as never);
  const success = jest.fn();
  const fail = jest.fn();
  const error = jest.fn();
  // passport-strategy 콜백을 jest 스텁으로 교체.
  (s as unknown as { success: unknown }).success = success;
  (s as unknown as { fail: unknown }).fail = fail;
  (s as unknown as { error: unknown }).error = error;
  return { s, authenticateToken, success, fail, error };
};

const bearer = (t: string): Req => ({ headers: { authorization: `Bearer ${t}` } });

describe('ApiTokenStrategy.authenticate', () => {
  it('Authorization 헤더 없으면 fail + 서비스 미호출', async () => {
    const { s, authenticateToken, fail, success } = make(null);
    await s.authenticate({ headers: {} } as never);
    expect(fail).toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(authenticateToken).not.toHaveBeenCalled();
  });

  it('Bearer 가 아니면 fail', async () => {
    const { s, fail, authenticateToken } = make(null);
    await s.authenticate({ headers: { authorization: 'Basic abc' } } as never);
    expect(fail).toHaveBeenCalled();
    expect(authenticateToken).not.toHaveBeenCalled();
  });

  it('유효 토큰 → success(주인)', async () => {
    const user = { id: 'u1', role: 'ADMIN' };
    const { s, success, fail, authenticateToken } = make(user);
    await s.authenticate(bearer('dsp_ok') as never);
    expect(authenticateToken).toHaveBeenCalledWith('dsp_ok');
    expect(success).toHaveBeenCalledWith(user);
    expect(fail).not.toHaveBeenCalled();
  });

  it('서비스가 null(무효/폐기/만료) → fail', async () => {
    const { s, success, fail } = make(null);
    await s.authenticate(bearer('dsp_bad') as never);
    expect(fail).toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it('서비스 내부 오류 → error(인증 실패와 구분)', async () => {
    const { s, error, fail, success } = make(null, { throws: true });
    await s.authenticate(bearer('dsp_x') as never);
    expect(error).toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });
});
