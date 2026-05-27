import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 49 — AuthService.updateMyPrefs 단위 검증. 다른 메서드는 변경 없음.

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: { user: { update: jest.Mock } };

  beforeEach(async () => {
    prismaMock = { user: { update: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { sign: jest.fn() } },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe('updateMyPrefs', () => {
    const baseUser = {
      id: 'u1',
      username: 'alice',
      name: 'Alice',
      department: 'Eng',
      role: 'DEVELOPER',
      createdAt: new Date('2026-05-27T00:00:00Z'),
      showPersonalSpaceInSidebar: false,
    };

    it('updates only provided field and returns sanitized AuthUser', async () => {
      prismaMock.user.update.mockResolvedValue({
        ...baseUser,
        showPersonalSpaceInSidebar: true,
      });

      const result = await service.updateMyPrefs('u1', {
        showPersonalSpaceInSidebar: true,
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { showPersonalSpaceInSidebar: true },
      });
      // sanitize 결과에 showPersonalSpaceInSidebar 가 포함되고 민감 필드는 빠진다.
      expect(result).toEqual({
        id: 'u1',
        username: 'alice',
        name: 'Alice',
        department: 'Eng',
        role: 'DEVELOPER',
        createdAt: baseUser.createdAt,
        showPersonalSpaceInSidebar: true,
      });
    });

    it('passes empty patch through to prisma (no-op update)', async () => {
      prismaMock.user.update.mockResolvedValue(baseUser);
      await service.updateMyPrefs('u1', {});
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {},
      });
    });
  });
});
