import { ForbiddenException } from '@nestjs/common';
import { WatchesController } from './watches.controller';

// Cycle L5-2 (feature/ldh) — 정책 7: 지켜보기 등록 = 페이지 읽기 권한.
//   (조회/해제는 본인 데이터라 그대로. 등록만 접근 권한 확인.)

describe('WatchesController (Cycle L5-2 watch 권한)', () => {
  const reqWith = (user: unknown) => ({ user }) as never;
  let watches: { watch: jest.Mock; unwatch: jest.Mock; isWatching: jest.Mock };
  let perms: { assertCanViewPage: jest.Mock };
  let ctrl: WatchesController;

  beforeEach(() => {
    watches = {
      watch: jest.fn().mockResolvedValue(undefined),
      unwatch: jest.fn().mockResolvedValue(undefined),
      isWatching: jest.fn().mockResolvedValue(false),
    };
    perms = { assertCanViewPage: jest.fn().mockResolvedValue(undefined) };
    ctrl = new WatchesController(watches as never, perms as never);
  });

  it('등록: 읽기 권한 확인 후 watch', async () => {
    await ctrl.create('p', reqWith({ id: 'u', role: 'DEVELOPER' }));
    expect(perms.assertCanViewPage).toHaveBeenCalledWith('p', {
      id: 'u',
      role: 'DEVELOPER',
    });
    expect(watches.watch).toHaveBeenCalledWith('u', 'p');
  });

  it('등록: 읽기 권한 없으면 403 + watch 안 함', async () => {
    perms.assertCanViewPage.mockRejectedValue(new ForbiddenException());
    await expect(
      ctrl.create('p', reqWith({ id: 'u', role: 'DEVELOPER' })),
    ).rejects.toThrow(ForbiddenException);
    expect(watches.watch).not.toHaveBeenCalled();
  });
});
