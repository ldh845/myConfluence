import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 48 — AdminService 단위 검증 (PrismaService mock).
// Cycle L2 (feature/ldh) — createLocalUser / setActive / listUsers 매핑 검증 추가.

describe('AdminService', () => {
  let service: AdminService;
  let prismaMock: {
    appConfig: { upsert: jest.Mock; update: jest.Mock };
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      appConfig: { upsert: jest.fn(), update: jest.fn() },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<AdminService>(AdminService);
  });

  describe('getConfig', () => {
    it('upserts singleton row (safe even if row deleted)', async () => {
      const row = {
        id: 'singleton',
        siteName: 'DocSpace',
        uploadLimitMb: 100,
        sessionExpireMin: 10080,
        updatedAt: new Date(),
      };
      prismaMock.appConfig.upsert.mockResolvedValue(row);
      const result = await service.getConfig();
      expect(result).toBe(row);
      expect(prismaMock.appConfig.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton' },
      });
    });
  });

  describe('updateConfig', () => {
    it('updates only provided fields on singleton row', async () => {
      prismaMock.appConfig.update.mockResolvedValue({
        id: 'singleton',
        siteName: 'New Name',
        uploadLimitMb: 200,
        sessionExpireMin: 10080,
        updatedAt: new Date(),
      });
      await service.updateConfig({ siteName: 'New Name', uploadLimitMb: 200 });
      expect(prismaMock.appConfig.update).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        data: { siteName: 'New Name', uploadLimitMb: 200 },
      });
    });
  });

  describe('listUsers', () => {
    it('excludes legacy and maps hash/keycloak to safe boolean flags', async () => {
      // Cycle L2 — passwordHash/keycloakId 는 내부 계산용으로만 select 되고,
      // 반환 객체에는 hasLocalPassword/isSso 불리언만 남고 원본은 제거된다.
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          username: 'alice',
          email: 'a@x.com',
          emailVerified: true,
          name: 'Alice',
          department: 'Eng',
          role: 'ADMIN',
          isActive: true,
          lastLoginAt: null,
          createdAt: new Date(),
          passwordHash: 'hash',
          keycloakId: 'kc-1',
        },
        {
          id: 'u2',
          username: 'bob',
          email: null,
          emailVerified: false,
          name: 'Bob',
          department: 'Eng',
          role: 'DEVELOPER',
          isActive: false,
          lastLoginAt: null,
          createdAt: new Date(),
          passwordHash: null,
          keycloakId: 'kc-2',
        },
      ]);
      const result = await service.listUsers();
      const call = prismaMock.user.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ NOT: { username: 'legacy' } });
      expect(call.orderBy).toEqual({ createdAt: 'desc' });
      expect(call.select).toMatchObject({ isActive: true });

      // 혼합 계정(hash + keycloak): 둘 다 true.
      expect(result[0]).toMatchObject({ hasLocalPassword: true, isSso: true });
      // SSO 전용(hash 없음): 로컬 false, SSO true.
      expect(result[1]).toMatchObject({ hasLocalPassword: false, isSso: true });
      // 원본 해시/키클락 id 는 절대 노출되지 않는다.
      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(result[0]).not.toHaveProperty('keycloakId');
    });
  });

  // Cycle L2 (feature/ldh) — 로컬 계정 생성.
  describe('createLocalUser', () => {
    const input = {
      username: 'newbie',
      name: 'New Bie',
      department: 'IT',
      email: 'newbie@x.com',
      password: 'pw1234',
    };

    it('hashes password, sets keycloakId null, returns no hash', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'u9',
        username: 'newbie',
        name: 'New Bie',
        department: 'IT',
        email: 'newbie@x.com',
        role: 'DEVELOPER',
        isActive: true,
      });

      const result = await service.createLocalUser(input);

      const createArg = prismaMock.user.create.mock.calls[0][0];
      expect(createArg.data.keycloakId).toBeNull();
      expect(typeof createArg.data.passwordHash).toBe('string');
      expect(createArg.data.passwordHash).not.toBe('pw1234'); // 평문 아님
      expect(createArg.select).not.toHaveProperty('passwordHash');
      expect(result).toMatchObject({
        id: 'u9',
        username: 'newbie',
        hasLocalPassword: true,
        isSso: false,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws 409 when username already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.createLocalUser(input)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  // Cycle L2 (feature/ldh) — 계정 활성/비활성 토글.
  describe('setActive', () => {
    it('updates isActive when target is another user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u2' });
      prismaMock.user.update.mockResolvedValue({
        id: 'u2',
        username: 'bob',
        isActive: false,
      });
      const result = await service.setActive('u2', false, 'admin-1');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { isActive: false },
        select: { id: true, username: true, isActive: true },
      });
      expect(result).toEqual({ id: 'u2', username: 'bob', isActive: false });
    });

    it('throws 400 when admin tries to deactivate self', async () => {
      await expect(
        service.setActive('admin-1', false, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      // 자기 자신 비활성화는 DB 조회 전에 차단.
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('allows reactivating self (isActive=true)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'admin-1' });
      prismaMock.user.update.mockResolvedValue({
        id: 'admin-1',
        username: 'admin',
        isActive: true,
      });
      const result = await service.setActive('admin-1', true, 'admin-1');
      expect(result.isActive).toBe(true);
    });
  });
});
