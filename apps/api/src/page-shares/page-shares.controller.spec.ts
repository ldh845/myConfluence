import { ForbiddenException } from '@nestjs/common';
import { PageSharesController } from './page-shares.controller';

// Cycle L5-2 (feature/ldh) — 정책 8/9/10: 공유 발급·회전·취소 = 페이지 편집 권한.

describe('PageSharesController (Cycle L5-2 공유 권한)', () => {
  const reqWith = (user: unknown) => ({ user }) as never;
  let shares: { getOrCreate: jest.Mock; rotate: jest.Mock; revoke: jest.Mock };
  let perms: { assertCanEditPage: jest.Mock };
  let ctrl: PageSharesController;

  beforeEach(() => {
    shares = {
      getOrCreate: jest.fn().mockResolvedValue({ token: 't' }),
      rotate: jest.fn().mockResolvedValue({ token: 't2' }),
      revoke: jest.fn().mockResolvedValue({ ok: true }),
    };
    perms = { assertCanEditPage: jest.fn().mockResolvedValue(undefined) };
    ctrl = new PageSharesController(
      shares as never,
      {} as never,
      {} as never,
      perms as never,
    );
  });

  const actor = { id: 'u', role: 'DEVELOPER' };

  it('발급: 편집 권한 확인 후 발급', async () => {
    await ctrl.create('p', reqWith(actor));
    expect(perms.assertCanEditPage).toHaveBeenCalledWith('p', actor);
    expect(shares.getOrCreate).toHaveBeenCalled();
  });

  it('발급: 편집 권한 없으면 403 + 발급 안 함', async () => {
    perms.assertCanEditPage.mockRejectedValue(new ForbiddenException());
    await expect(ctrl.create('p', reqWith(null))).rejects.toThrow(
      ForbiddenException,
    );
    expect(shares.getOrCreate).not.toHaveBeenCalled();
  });

  it('회전: 편집 권한 확인 후 rotate', async () => {
    await ctrl.rotate('p', reqWith(actor));
    expect(perms.assertCanEditPage).toHaveBeenCalledWith('p', actor);
    expect(shares.rotate).toHaveBeenCalled();
  });

  it('회전: 편집 권한 없으면 403 + rotate 안 함', async () => {
    perms.assertCanEditPage.mockRejectedValue(new ForbiddenException());
    await expect(ctrl.rotate('p', reqWith(null))).rejects.toThrow(
      ForbiddenException,
    );
    expect(shares.rotate).not.toHaveBeenCalled();
  });

  it('취소: 편집 권한 확인 후 revoke', async () => {
    await ctrl.revoke('p', reqWith(actor));
    expect(perms.assertCanEditPage).toHaveBeenCalledWith('p', actor);
    expect(shares.revoke).toHaveBeenCalled();
  });

  it('취소: 편집 권한 없으면 403 + revoke 안 함', async () => {
    perms.assertCanEditPage.mockRejectedValue(new ForbiddenException());
    await expect(ctrl.revoke('p', reqWith(null))).rejects.toThrow(
      ForbiddenException,
    );
    expect(shares.revoke).not.toHaveBeenCalled();
  });
});
