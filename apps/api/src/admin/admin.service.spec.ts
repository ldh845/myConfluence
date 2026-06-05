import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 48 — AdminService 단위 검증 (PrismaService mock).
// Cycle L2 (feature/ldh) — createLocalUser / setActive / listUsers 매핑 검증 추가.
// Cycle L3 (feature/ldh) — 비번 정책 적용 / unlockUser / 잠금 매핑 검증 추가.
// Cycle L4 (feature/ldh) — setRole(로컬 변경 / SSO 거부 / 자기 자신 거부 / 404) 검증 추가.

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
          // 미래 잠금 → locked true.
          lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
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
          // 과거 잠금 → locked false(만료).
          lockedUntil: new Date(Date.now() - 10 * 60 * 1000),
        },
      ]);
      const result = await service.listUsers();
      const call = prismaMock.user.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ NOT: { username: 'legacy' } });
      expect(call.orderBy).toEqual({ createdAt: 'desc' });
      expect(call.select).toMatchObject({ isActive: true, lockedUntil: true });

      // 혼합 계정(hash + keycloak): 둘 다 true. 미래 잠금 → locked true.
      expect(result[0]).toMatchObject({
        hasLocalPassword: true,
        isSso: true,
        locked: true,
      });
      // SSO 전용(hash 없음): 로컬 false, SSO true. 만료 잠금 → locked false + lockedUntil null.
      expect(result[1]).toMatchObject({
        hasLocalPassword: false,
        isSso: true,
        locked: false,
        lockedUntil: null,
      });
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
      password: 'newbie123', // 정책 통과(8자+영문+숫자)
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
      expect(createArg.data.passwordHash).not.toBe('newbie123'); // 평문 아님
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

    // Cycle L3 — 약한 비번은 중복 검사 전에 정책 위반 400.
    it('throws 400 when password violates policy', async () => {
      await expect(
        service.createLocalUser({ ...input, password: 'weak' }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  // Cycle L3 (feature/ldh) — 로그인 실패 잠금 해제.
  describe('unlockUser', () => {
    it('resets failedLoginCount and lockedUntil', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u2' });
      prismaMock.user.update.mockResolvedValue({ id: 'u2', username: 'bob' });
      const result = await service.unlockUser('u2');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { failedLoginCount: 0, lockedUntil: null },
        select: { id: true, username: true },
      });
      expect(result).toEqual({ id: 'u2', username: 'bob', locked: false });
    });

    it('throws 404 when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.unlockUser('ghost')).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
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

  // Cycle L4 (feature/ldh) — 로컬 전용 계정 역할 변경.
  describe('setRole', () => {
    it('updates role for a local-only account (keycloakId null)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u2',
        username: 'localtest',
        keycloakId: null,
      });
      prismaMock.user.update.mockResolvedValue({
        id: 'u2',
        username: 'localtest',
        role: 'ADMIN',
      });
      const result = await service.setRole('u2', 'ADMIN', 'admin-1');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { role: 'ADMIN' },
        select: { id: true, username: true, role: true },
      });
      expect(result).toEqual({ id: 'u2', username: 'localtest', role: 'ADMIN' });
    });

    it('throws 400 when target is an SSO account (keycloakId present)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u3',
        username: 'ssouser',
        keycloakId: 'kc-3',
      });
      await expect(service.setRole('u3', 'ADMIN', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('throws 400 when changing own role (before DB lookup)', async () => {
      await expect(
        service.setRole('admin-1', 'DEVELOPER', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      // 자기 자신은 DB 조회 전에 차단.
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('throws 404 when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.setRole('ghost', 'ADMIN', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });
});
