import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 48 — AdminService 단위 검증 (PrismaService mock).

describe('AdminService', () => {
  let service: AdminService;
  let prismaMock: {
    appConfig: { upsert: jest.Mock; update: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prismaMock = {
      appConfig: { upsert: jest.fn(), update: jest.fn() },
      user: { findMany: jest.fn() },
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
    it('excludes legacy and selects only admin-relevant fields', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      await service.listUsers();
      const call = prismaMock.user.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ NOT: { username: 'legacy' } });
      expect(call.orderBy).toEqual({ createdAt: 'desc' });
      expect(call.select).toMatchObject({
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        name: true,
        role: true,
        lastLoginAt: true,
      });
      // passwordHash / keycloakId 누락 검증.
      expect(call.select).not.toHaveProperty('passwordHash');
      expect(call.select).not.toHaveProperty('keycloakId');
    });
  });
});
