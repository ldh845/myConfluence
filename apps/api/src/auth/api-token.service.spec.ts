import { NotFoundException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { ApiTokenService } from './api-token.service';

// Cycle L-API-1 (feature/ldh) — API 토큰 발급/검증/폐기 단위 검증.
//   보안 핵심: 평문은 발급 응답에만, 저장은 sha256 해시만, 비교는 해시로만.
//   인증: 폐기/만료/미존재/비활성 → null. lastUsedAt 분 단위 throttle.

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const makePrisma = (over: Record<string, unknown> = {}) => ({
  apiToken: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
  },
  ...over,
});

const activeUser = {
  id: 'u1',
  username: 'alice',
  name: 'Alice',
  department: '플랫폼',
  role: 'DEVELOPER',
  createdAt: new Date('2026-01-01'),
  isActive: true,
  hasLocalPassword: false,
  showPersonalSpaceInSidebar: false,
};

const makeAuth = (user: unknown = activeUser) => ({
  findById: jest.fn().mockResolvedValue(user),
});

const svc = (prisma: object, auth: object) =>
  new ApiTokenService(prisma as never, auth as never);

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

describe('ApiTokenService — createForUser (발급)', () => {
  const prismaEcho = () =>
    makePrisma({
      apiToken: {
        create: jest.fn().mockImplementation(({ data }: { data: any }) =>
          Promise.resolve({
            id: 't1',
            name: data.name,
            tokenHash: data.tokenHash,
            tokenPrefix: data.tokenPrefix,
            expiresAt: data.expiresAt,
            createdAt: new Date('2026-06-09'),
          }),
        ),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    });

  it('평문 토큰은 dsp_ 접두 + 응답에만 노출, 저장은 sha256 해시만(평문 미저장)', async () => {
    const prisma = prismaEcho();
    const issued = await svc(prisma, makeAuth()).createForUser('u1', 'CI 봇');

    expect(issued.token.startsWith('dsp_')).toBe(true);
    expect(issued.token.length).toBeGreaterThan(20);

    const data = prisma.apiToken.create.mock.calls[0][0].data;
    // 저장 데이터엔 평문이 없고, 해시는 평문의 sha256 과 일치.
    expect(data.tokenHash).toBe(sha256(issued.token));
    expect(data).not.toHaveProperty('token');
    // 평문 난수 본문(접두 이후)이 저장 데이터 어디에도 들어가지 않는다.
    const randomBody = issued.token.slice('dsp_'.length);
    expect(JSON.stringify(data)).not.toContain(randomBody);
    // 표시용 prefix 는 평문 앞 12자('dsp_'+8).
    expect(data.tokenPrefix).toBe(issued.token.slice(0, 12));
    expect(issued.tokenPrefix).toBe(data.tokenPrefix);
  });

  it('expiresInDays 없으면 무기한(expiresAt=null)', async () => {
    const prisma = prismaEcho();
    const issued = await svc(prisma, makeAuth()).createForUser('u1', 'no-exp');
    expect(issued.expiresAt).toBeNull();
  });

  it('expiresInDays 있으면 그 일수 뒤 만료', async () => {
    const prisma = prismaEcho();
    const before = Date.now();
    const issued = await svc(prisma, makeAuth()).createForUser('u1', 'exp', 30);
    const after = Date.now();
    expect(issued.expiresAt).not.toBeNull();
    const ms = issued.expiresAt!.getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 30 * 86_400_000);
    expect(ms).toBeLessThanOrEqual(after + 30 * 86_400_000);
  });
});

describe('ApiTokenService — listForUser (목록, 평문 없음)', () => {
  it('select 에 tokenHash 가 없다(평문/해시 미노출)', async () => {
    const prisma = makePrisma();
    await svc(prisma, makeAuth()).listForUser('u1');
    const arg = prisma.apiToken.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'u1' });
    expect(arg.select).not.toHaveProperty('tokenHash');
    expect(arg.select.tokenPrefix).toBe(true);
  });
});

describe('ApiTokenService — revokeForUser (본인 폐기)', () => {
  it('본인 토큰 폐기 → revokedAt 설정', async () => {
    const prisma = makePrisma({
      apiToken: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 't1', userId: 'u1', revokedAt: null }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    const r = await svc(prisma, makeAuth()).revokeForUser('u1', 't1');
    expect(r).toEqual({ ok: true });
    expect(prisma.apiToken.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('남의 토큰이면 404(존재 노출 회피)', async () => {
    const prisma = makePrisma({
      apiToken: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 't1', userId: 'other', revokedAt: null }),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    await expect(
      svc(prisma, makeAuth()).revokeForUser('u1', 't1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.apiToken.update).not.toHaveBeenCalled();
  });

  it('이미 폐기된 토큰은 idempotent(재update 안 함)', async () => {
    const prisma = makePrisma({
      apiToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't1',
          userId: 'u1',
          revokedAt: new Date('2026-06-01'),
        }),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    const r = await svc(prisma, makeAuth()).revokeForUser('u1', 't1');
    expect(r).toEqual({ ok: true });
    expect(prisma.apiToken.update).not.toHaveBeenCalled();
  });
});

describe('ApiTokenService — revokeAny (admin 강제 폐기)', () => {
  it('누구의 토큰이든 폐기', async () => {
    const prisma = makePrisma({
      apiToken: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 't9', userId: 'someone', revokedAt: null }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    const r = await svc(prisma, makeAuth()).revokeAny('t9');
    expect(r).toEqual({ ok: true });
    expect(prisma.apiToken.update).toHaveBeenCalled();
  });

  it('없으면 404', async () => {
    const prisma = makePrisma();
    await expect(
      svc(prisma, makeAuth()).revokeAny('nope'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ApiTokenService — authenticateToken (Bearer 검증)', () => {
  const validRec = {
    id: 't1',
    userId: 'u1',
    tokenHash: sha256('dsp_valid'),
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: null,
  };

  it('유효 토큰 → 발급자(주인) 승계 + lastUsedAt 갱신', async () => {
    const prisma = makePrisma({
      apiToken: {
        findUnique: jest.fn().mockResolvedValue(validRec),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    const auth = makeAuth();
    const user = await svc(prisma, auth).authenticateToken('dsp_valid');
    expect(user).toBe(activeUser);
    expect(auth.findById).toHaveBeenCalledWith('u1');
    // 해시로만 조회.
    expect(prisma.apiToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256('dsp_valid') },
    });
    // lastUsedAt null → 갱신.
    expect(prisma.apiToken.update).toHaveBeenCalled();
  });

  it('dsp_ 접두 아니면 조회조차 안 하고 null', async () => {
    const prisma = makePrisma();
    const r = await svc(prisma, makeAuth()).authenticateToken('xxx');
    expect(r).toBeNull();
    expect(prisma.apiToken.findUnique).not.toHaveBeenCalled();
  });

  it('미존재 토큰 → null', async () => {
    const prisma = makePrisma();
    const r = await svc(prisma, makeAuth()).authenticateToken('dsp_none');
    expect(r).toBeNull();
  });

  it('폐기된 토큰 → null(주인 조회 안 함)', async () => {
    const prisma = makePrisma({
      apiToken: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...validRec, revokedAt: new Date('2026-06-01') }),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    const auth = makeAuth();
    const r = await svc(prisma, auth).authenticateToken('dsp_valid');
    expect(r).toBeNull();
    expect(auth.findById).not.toHaveBeenCalled();
  });

  it('만료된 토큰 → null', async () => {
    const prisma = makePrisma({
      apiToken: {
        findUnique: jest.fn().mockResolvedValue({
          ...validRec,
          expiresAt: new Date(Date.now() - 1000),
        }),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    const r = await svc(prisma, makeAuth()).authenticateToken('dsp_valid');
    expect(r).toBeNull();
  });

  it('비활성 사용자(isActive=false) → null(L2 일관)', async () => {
    const prisma = makePrisma({
      apiToken: {
        findUnique: jest.fn().mockResolvedValue(validRec),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    const auth = makeAuth({ ...activeUser, isActive: false });
    const r = await svc(prisma, auth).authenticateToken('dsp_valid');
    expect(r).toBeNull();
  });

  it('lastUsedAt 가 최근(throttle 내)이면 갱신 생략', async () => {
    const prisma = makePrisma({
      apiToken: {
        findUnique: jest.fn().mockResolvedValue({
          ...validRec,
          lastUsedAt: new Date(Date.now() - 5_000),
        }),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    await svc(prisma, makeAuth()).authenticateToken('dsp_valid');
    expect(prisma.apiToken.update).not.toHaveBeenCalled();
  });

  it('lastUsedAt 가 오래됐으면(throttle 초과) 갱신', async () => {
    const prisma = makePrisma({
      apiToken: {
        findUnique: jest.fn().mockResolvedValue({
          ...validRec,
          lastUsedAt: new Date(Date.now() - 120_000),
        }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });
    await svc(prisma, makeAuth()).authenticateToken('dsp_valid');
    expect(prisma.apiToken.update).toHaveBeenCalled();
  });
});
