import { ForbiddenException } from '@nestjs/common';
import { ReactionsController } from './reactions.controller';

// Cycle L5-2 (feature/ldh) — 정책 6: 리액션 토글 = 페이지 읽기 권한.
//   page 대상은 그 페이지, comment 대상은 comment→page 해석 후 판정.

describe('ReactionsController (Cycle L5-2 toggle 권한)', () => {
  const reqWith = (user: unknown) => ({ user }) as never;
  let reactions: { toggle: jest.Mock };
  let perms: { assertCanViewPage: jest.Mock };
  let prisma: { comment: { findUnique: jest.Mock } };
  let ctrl: ReactionsController;

  beforeEach(() => {
    reactions = { toggle: jest.fn().mockResolvedValue({ reacted: true }) };
    perms = { assertCanViewPage: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      comment: {
        findUnique: jest.fn().mockResolvedValue({ pageId: 'p-from-comment' }),
      },
    };
    ctrl = new ReactionsController(
      reactions as never,
      perms as never,
      prisma as never,
    );
  });

  it('page 리액션: 그 페이지 읽기 권한 확인 후 토글', async () => {
    await ctrl.toggle(
      { emoji: '👍', pageId: 'p' } as never,
      reqWith({ id: 'u', role: 'DEVELOPER' }),
    );
    expect(perms.assertCanViewPage).toHaveBeenCalledWith('p', {
      id: 'u',
      role: 'DEVELOPER',
    });
    expect(reactions.toggle).toHaveBeenCalled();
  });

  it('comment 리액션: comment→page 해석 후 그 페이지 읽기 권한 확인', async () => {
    await ctrl.toggle(
      { emoji: '👍', commentId: 'cm' } as never,
      reqWith({ id: 'u', role: 'DEVELOPER' }),
    );
    expect(prisma.comment.findUnique).toHaveBeenCalled();
    expect(perms.assertCanViewPage).toHaveBeenCalledWith('p-from-comment', {
      id: 'u',
      role: 'DEVELOPER',
    });
    expect(reactions.toggle).toHaveBeenCalled();
  });

  it('읽기 권한 없으면 403 + 토글 안 함', async () => {
    perms.assertCanViewPage.mockRejectedValue(new ForbiddenException());
    await expect(
      ctrl.toggle({ emoji: '👍', pageId: 'p' } as never, reqWith(null)),
    ).rejects.toThrow(ForbiddenException);
    expect(reactions.toggle).not.toHaveBeenCalled();
  });
});
