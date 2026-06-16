import { ForbiddenException } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';

// Cycle L5 (feature/ldh) — 첨부 라우트 권한 가드 검증.
//   업로드/삭제 = 페이지 편집 권한, 목록/다운로드 = 페이지 읽기 권한.
//   권한 거부 시 실제 부작용(저장/삭제/스트림)이 일어나지 않아야 한다.

describe('AttachmentsController (Cycle L5 가드)', () => {
  const reqWith = (user: unknown) => ({ user }) as never;
  let attachments: {
    createOnPage: jest.Mock;
    listByPage: jest.Mock;
    getById: jest.Mock;
    remove: jest.Mock;
    createReadStream: jest.Mock;
  };
  let perms: { assertCanEditPage: jest.Mock; assertCanViewPage: jest.Mock };
  let ctrl: AttachmentsController;

  beforeEach(() => {
    attachments = {
      createOnPage: jest.fn().mockResolvedValue({ id: 'a' }),
      listByPage: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue({
        id: 'a',
        pageId: 'p',
        mimetype: 'image/png',
        size: 10,
        filename: 'f.png',
        storageKey: 'k',
      }),
      remove: jest.fn().mockResolvedValue({ ok: true }),
      createReadStream: jest.fn(),
    };
    perms = {
      assertCanEditPage: jest.fn().mockResolvedValue(undefined),
      assertCanViewPage: jest.fn().mockResolvedValue(undefined),
    };
    ctrl = new AttachmentsController(
      attachments as never,
      perms as never,
    );
  });

  it('업로드: 편집 권한 확인 후 저장', async () => {
    const actor = { id: 'u', role: 'DEVELOPER' };
    await ctrl.uploadAttachment('p', {} as never, {} as never, reqWith(actor));
    expect(perms.assertCanEditPage).toHaveBeenCalledWith('p', actor);
    expect(attachments.createOnPage).toHaveBeenCalled();
  });

  it('업로드: 편집 권한 없으면 403 + 저장 안 함', async () => {
    perms.assertCanEditPage.mockRejectedValue(new ForbiddenException());
    await expect(
      ctrl.uploadAttachment('p', {} as never, {} as never, reqWith(null)),
    ).rejects.toThrow(ForbiddenException);
    expect(attachments.createOnPage).not.toHaveBeenCalled();
  });

  it('목록: 읽기 권한 확인', async () => {
    await ctrl.listByPage('p', reqWith(null));
    expect(perms.assertCanViewPage).toHaveBeenCalledWith('p', null);
    expect(attachments.listByPage).toHaveBeenCalledWith('p');
  });

  it('다운로드: 읽기 권한 확인 후 스트림', async () => {
    const stream = { on: jest.fn(), pipe: jest.fn() };
    attachments.createReadStream.mockReturnValue(stream);
    const res = {
      setHeader: jest.fn(),
      status: jest.fn(),
      end: jest.fn(),
      headersSent: false,
    };
    await ctrl.download('a', reqWith(null), res as never);
    expect(perms.assertCanViewPage).toHaveBeenCalledWith('p', null);
    expect(stream.pipe).toHaveBeenCalledWith(res);
  });

  it('다운로드: 읽기 권한 없으면 403 + 스트림 안 함', async () => {
    perms.assertCanViewPage.mockRejectedValue(new ForbiddenException());
    const res = { setHeader: jest.fn() };
    await expect(ctrl.download('a', reqWith(null), res as never)).rejects.toThrow(
      ForbiddenException,
    );
    expect(attachments.createReadStream).not.toHaveBeenCalled();
  });

  it('삭제: 첨부→페이지 편집 권한 확인 후 삭제', async () => {
    const actor = { id: 'u', role: 'DEVELOPER' };
    await ctrl.remove('a', reqWith(actor));
    expect(attachments.getById).toHaveBeenCalledWith('a');
    expect(perms.assertCanEditPage).toHaveBeenCalledWith('p', actor);
    expect(attachments.remove).toHaveBeenCalledWith('a');
  });

  it('삭제: 편집 권한 없으면 403 + 삭제 안 함', async () => {
    perms.assertCanEditPage.mockRejectedValue(new ForbiddenException());
    await expect(ctrl.remove('a', reqWith(null))).rejects.toThrow(
      ForbiddenException,
    );
    expect(attachments.remove).not.toHaveBeenCalled();
  });
});
