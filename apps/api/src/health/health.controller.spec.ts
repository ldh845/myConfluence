import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 46 — liveness/readiness 분리 단위 검증.

describe('HealthController', () => {
  let controller: HealthController;
  let prismaMock: { $queryRawUnsafe: jest.Mock };

  beforeEach(async () => {
    prismaMock = { $queryRawUnsafe: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();
    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health/live', () => {
    it('returns 200 immediately without touching DB', () => {
      const result = controller.live();
      expect(result).toEqual({ status: 'ok' });
      expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 with db version on success', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { version: 'PostgreSQL 16.4' },
      ]);
      const result = await controller.ready();
      expect(result).toEqual({ status: 'ok', db: 'PostgreSQL 16.4' });
    });

    it('throws 503 when DB is unreachable', async () => {
      prismaMock.$queryRawUnsafe.mockRejectedValue(
        new Error('connect ECONNREFUSED'),
      );
      await expect(controller.ready()).rejects.toThrow(HttpException);
      await expect(controller.ready()).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });

  describe('GET /health (compat alias)', () => {
    it('behaves like /ready on success', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([{ version: 'pg' }]);
      const result = await controller.check();
      expect(result).toEqual({ status: 'ok', db: 'pg' });
    });

    it('throws 503 on DB failure (same as /ready)', async () => {
      prismaMock.$queryRawUnsafe.mockRejectedValue(new Error('down'));
      await expect(controller.check()).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });
});
