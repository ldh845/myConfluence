import type { Request, Response } from 'express';
import { noStore } from './no-store.middleware';

// Cycle L4 followup (feature/ldh) — 일반 JSON API 응답엔 no-store 가 붙고,
// 파일 다운로드(첨부) 라우트엔 붙지 않는지 검증.

describe('noStore middleware', () => {
  const run = (method: string, path: string) => {
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();
    noStore({ method, path } as Request, res, next);
    return { res, next };
  };

  it('sets no-store on a normal JSON API response (/auth/me)', () => {
    const { res, next } = run('GET', '/auth/me');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(next).toHaveBeenCalled();
  });

  it('sets no-store on a mutation (PATCH role)', () => {
    const { res } = run('PATCH', '/admin/users/u1/role');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('still sets no-store on the attachment LIST (GET /pages/:id/attachments)', () => {
    // 목록은 JSON 이므로 제외 대상이 아니다(다운로드 경로와 패턴이 다름).
    const { res } = run('GET', '/pages/p1/attachments');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('does NOT set no-store on attachment download (GET /attachments/:id)', () => {
    const { res, next } = run('GET', '/attachments/att-1');
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('does NOT set no-store on shared attachment download', () => {
    const { res } = run('GET', '/share/tok-1/attachments/att-1');
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
