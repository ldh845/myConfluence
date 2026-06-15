import { ForbiddenException } from '@nestjs/common';
import { CommentsController } from './comments.controller';

// Cycle L5-2 (feature/ldh) — 댓글 쓰기 경로 권한 정책 검증.
//   1) 작성 = 페이지 읽기 권한, 2) 수정 = 본인만(관리자도 불가),
//   3) 삭제 = 본인 OR 공간 관리, 4/5) resolve/unresolve = 페이지 편집 권한.

describe('CommentsController (Cycle L5-2 쓰기 권한)', () => {
  const reqWith = (user: unknown) => ({ user }) as never;
  let comments: {
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    resolve: jest.Mock;
    unresolve: jest.Mock;
    getContext: jest.Mock;
  };
  let perms: {
    assertCanViewPage: jest.Mock;
    assertCanEditPage: jest.Mock;
    assertCanManage: jest.Mock;
  };
  let ctrl: CommentsController;

  beforeEach(() => {
    comments = {
      create: jest.fn().mockResolvedValue({ id: 'c' }),
      update: jest.fn().mockResolvedValue({ id: 'c' }),
      remove: jest.fn().mockResolvedValue({ ok: true }),
      resolve: jest.fn().mockResolvedValue({ id: 'c' }),
      unresolve: jest.fn().mockResolvedValue({ id: 'c' }),
      getContext: jest
        .fn()
        .mockResolvedValue({ pageId: 'p', spaceId: 's', authorId: 'owner' }),
    };
    perms = {
      assertCanViewPage: jest.fn().mockResolvedValue(undefined),
      assertCanEditPage: jest.fn().mockResolvedValue(undefined),
      assertCanManage: jest.fn().mockResolvedValue(undefined),
    };
    ctrl = new CommentsController(comments as never, perms as never);
  });

  // 정책 1 — 작성: 페이지 읽기 권한.
  it('작성: 읽기 권한 확인 후 생성', async () => {
    await ctrl.create('p', {} as never, reqWith({ id: 'u', role: 'DEVELOPER' }));
    expect(perms.assertCanViewPage).toHaveBeenCalledWith('p', {
      id: 'u',
      role: 'DEVELOPER',
    });
    expect(comments.create).toHaveBeenCalled();
  });

  it('작성: 읽기 권한 없으면 403 + 생성 안 함', async () => {
    perms.assertCanViewPage.mockRejectedValue(new ForbiddenException());
    await expect(
      ctrl.create('p', {} as never, reqWith(null)),
    ).rejects.toThrow(ForbiddenException);
    expect(comments.create).not.toHaveBeenCalled();
  });

  // 정책 2 — 수정: 본인만.
  it('수정: 본인이면 통과', async () => {
    await ctrl.update('c', {} as never, reqWith({ id: 'owner', role: 'DEVELOPER' }));
    expect(comments.update).toHaveBeenCalledWith('c', {});
  });

  it('수정: 타인이면 403 + 수정 안 함', async () => {
    await expect(
      ctrl.update('c', {} as never, reqWith({ id: 'someone', role: 'DEVELOPER' })),
    ).rejects.toThrow(ForbiddenException);
    expect(comments.update).not.toHaveBeenCalled();
  });

  it('수정: 전역 ADMIN 이라도 본인 아니면 403 (내용 조작 방지)', async () => {
    await expect(
      ctrl.update('c', {} as never, reqWith({ id: 'admin', role: 'ADMIN' })),
    ).rejects.toThrow(ForbiddenException);
    expect(comments.update).not.toHaveBeenCalled();
  });

  // 정책 3 — 삭제: 본인 OR 공간 관리.
  it('삭제: 본인이면 manage 검사 없이 삭제', async () => {
    await ctrl.remove('c', reqWith({ id: 'owner', role: 'DEVELOPER' }));
    expect(perms.assertCanManage).not.toHaveBeenCalled();
    expect(comments.remove).toHaveBeenCalledWith('c');
  });

  it('삭제: 타인이지만 공간 관리 권한이면 삭제', async () => {
    await ctrl.remove('c', reqWith({ id: 'mgr', role: 'DEVELOPER' }));
    expect(perms.assertCanManage).toHaveBeenCalledWith('s', {
      id: 'mgr',
      role: 'DEVELOPER',
    });
    expect(comments.remove).toHaveBeenCalledWith('c');
  });

  it('삭제: 타인 + 관리 권한 없으면 403 + 삭제 안 함', async () => {
    perms.assertCanManage.mockRejectedValue(new ForbiddenException());
    await expect(
      ctrl.remove('c', reqWith({ id: 'nobody', role: 'DEVELOPER' })),
    ).rejects.toThrow(ForbiddenException);
    expect(comments.remove).not.toHaveBeenCalled();
  });

  // 정책 4/5 — resolve/unresolve: 페이지 편집 권한.
  it('resolve: 편집 권한 확인 후 처리', async () => {
    await ctrl.resolve('c', {} as never, reqWith({ id: 'u', role: 'DEVELOPER' }));
    expect(perms.assertCanEditPage).toHaveBeenCalledWith('p', {
      id: 'u',
      role: 'DEVELOPER',
    });
    expect(comments.resolve).toHaveBeenCalled();
  });

  it('resolve: 편집 권한 없으면 403 + 처리 안 함', async () => {
    perms.assertCanEditPage.mockRejectedValue(new ForbiddenException());
    await expect(
      ctrl.resolve('c', {} as never, reqWith(null)),
    ).rejects.toThrow(ForbiddenException);
    expect(comments.resolve).not.toHaveBeenCalled();
  });

  it('unresolve: 편집 권한 확인 후 처리', async () => {
    await ctrl.unresolve('c', reqWith({ id: 'u', role: 'DEVELOPER' }));
    expect(perms.assertCanEditPage).toHaveBeenCalledWith('p', {
      id: 'u',
      role: 'DEVELOPER',
    });
    expect(comments.unresolve).toHaveBeenCalled();
  });

  it('unresolve: 편집 권한 없으면 403 + 처리 안 함', async () => {
    perms.assertCanEditPage.mockRejectedValue(new ForbiddenException());
    await expect(ctrl.unresolve('c', reqWith(null))).rejects.toThrow(
      ForbiddenException,
    );
    expect(comments.unresolve).not.toHaveBeenCalled();
  });
});
