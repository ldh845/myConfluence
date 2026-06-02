import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 55 — UsersService.findAll({ q? }) 검증.
//   - q 없음 → 기존 동작 (legacy 제외, name asc, password 미노출)
//   - q 있음 → OR(name, username) insensitive contains
//   - q 빈 문자열 / whitespace → 무시 (q 미지정과 동일)
//   - select 필드 회귀 가드 (passwordHash/keycloakId 미노출)

describe('UsersService', () => {
  let service: UsersService;
  let prismaMock: {
    user: { findMany: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  const findManyArg = () => prismaMock.user.findMany.mock.calls[0][0];

  it('q 없음 → where 에 legacy 제외만, OR 없음', () => {
    service.findAll();
    const arg = findManyArg();
    expect(arg.where).toEqual({ NOT: { username: 'legacy' } });
    expect(arg.where.OR).toBeUndefined();
  });

  it('q 있음 → OR(name, username) insensitive contains 추가, legacy 제외 유지', () => {
    service.findAll({ q: '홍길동' });
    const arg = findManyArg();
    expect(arg.where).toEqual({
      NOT: { username: 'legacy' },
      OR: [
        { name: { contains: '홍길동', mode: 'insensitive' } },
        { username: { contains: '홍길동', mode: 'insensitive' } },
      ],
    });
  });

  it('q 빈 문자열 → 무시 (q 미지정과 동일)', () => {
    service.findAll({ q: '' });
    expect(findManyArg().where.OR).toBeUndefined();
  });

  it('q whitespace 만 → 무시 (trim 후 빈 값)', () => {
    service.findAll({ q: '   ' });
    expect(findManyArg().where.OR).toBeUndefined();
  });

  it('q 양옆 공백 → trim 적용', () => {
    service.findAll({ q: '  kim  ' });
    const arg = findManyArg();
    expect(arg.where.OR[0].name.contains).toBe('kim');
    expect(arg.where.OR[1].username.contains).toBe('kim');
  });

  it('orderBy name asc, select 에 admin/멘션용 필드만 (보안 가드)', () => {
    service.findAll();
    const arg = findManyArg();
    expect(arg.orderBy).toEqual({ name: 'asc' });
    expect(arg.select).toEqual({
      id: true,
      name: true,
      department: true,
    });
    // passwordHash, keycloakId, email 등 노출 금지.
    expect(arg.select).not.toHaveProperty('passwordHash');
    expect(arg.select).not.toHaveProperty('keycloakId');
    expect(arg.select).not.toHaveProperty('email');
  });

  // Cycle 58 — findOne(id)
  describe('findOne', () => {
    it('정상 사용자 → id+username+name+department+role+createdAt 반환', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        username: 'kim',
        name: '김',
        department: '개발1팀',
        role: 'DEVELOPER',
        createdAt: new Date('2026-01-01'),
      });
      const r = await service.findOne('u-1');
      expect(r.username).toBe('kim');
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        select: expect.objectContaining({
          id: true,
          username: true,
          name: true,
          department: true,
          role: true,
          createdAt: true,
        }),
      });
    });

    it('legacy 사용자 → NotFoundException (가드)', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'legacy-id',
        username: 'legacy',
        name: '레거시',
        department: '',
        role: 'DEVELOPER',
        createdAt: new Date(),
      });
      await expect(service.findOne('legacy-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('미존재 → NotFoundException', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('select 에 민감 필드(passwordHash/keycloakId/email) 미노출 — 보안 가드', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        username: 'kim',
        name: '김',
        department: '',
        role: 'DEVELOPER',
        createdAt: new Date(),
      });
      await service.findOne('u-1');
      const arg = prismaMock.user.findUnique.mock.calls[0][0];
      expect(arg.select).not.toHaveProperty('passwordHash');
      expect(arg.select).not.toHaveProperty('keycloakId');
      expect(arg.select).not.toHaveProperty('email');
    });
  });
});
