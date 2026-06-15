import { ForbiddenException } from '@nestjs/common';
import { DiagramsController } from './diagrams.controller';

// Cycle L5 (feature/ldh) — 다이어그램 라우트 권한 가드 검증.
//   조회 = 읽기 권한, 수정/삭제 = 편집 권한. 모두 diagram→pageId 해석 후 판정.

describe('DiagramsController (Cycle L5 가드)', () => {
  const reqWith = (user: unknown) => ({ user }) as never;
  let diagrams: { findOne: jest.Mock; update: jest.Mock; remove: jest.Mock };
  let perms: { assertCanViewPage: jest.Mock; assertCanEditPage: jest.Mock };
  let ctrl: DiagramsController;

  beforeEach(() => {
    diagrams = {
      findOne: jest.fn().mockResolvedValue({ id: 'd', pageId: 'p', data: '{}' }),
      update: jest.fn().mockResolvedValue({ id: 'd' }),
      remove: jest.fn().mockResolvedValue({ ok: true }),
    };
    perms = {
      assertCanViewPage: jest.fn().mockResolvedValue(undefined),
      assertCanEditPage: jest.fn().mockResolvedValue(undefined),
    };
    ctrl = new DiagramsController(diagrams as never, perms as never);
  });

  it('조회: 읽기 권한 확인 후 반환', async () => {
    const r = await ctrl.findOne('d', reqWith(null));
    expect(perms.assertCanViewPage).toHaveBeenCalledWith('p', null);
    expect(r).toMatchObject({ id: 'd' });
  });

  it('수정: 편집 권한 확인 후 update', async () => {
    const actor = { id: 'u', role: 'DEVELOPER' };
    await ctrl.update('d', {} as never, reqWith(actor));
    expect(perms.assertCanEditPage).toHaveBeenCalledWith('p', actor);
    expect(diagrams.update).toHaveBeenCalledWith('d', {});
  });

  it('수정: 편집 권한 없으면 403 + update 안 함', async () => {
    perms.assertCanEditPage.mockRejectedValue(new ForbiddenException());
    await expect(
      ctrl.update('d', {} as never, reqWith(null)),
    ).rejects.toThrow(ForbiddenException);
    expect(diagrams.update).not.toHaveBeenCalled();
  });

  it('삭제: 편집 권한 확인 후 remove', async () => {
    const actor = { id: 'u', role: 'DEVELOPER' };
    await ctrl.remove('d', reqWith(actor));
    expect(perms.assertCanEditPage).toHaveBeenCalledWith('p', actor);
    expect(diagrams.remove).toHaveBeenCalledWith('d');
  });

  it('삭제: 편집 권한 없으면 403 + remove 안 함', async () => {
    perms.assertCanEditPage.mockRejectedValue(new ForbiddenException());
    await expect(ctrl.remove('d', reqWith(null))).rejects.toThrow(
      ForbiddenException,
    );
    expect(diagrams.remove).not.toHaveBeenCalled();
  });
});
