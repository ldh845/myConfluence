import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 49 — AuthService.updateMyPrefs 단위 검증.
// Cycle L1 (feature/ldh) — localLogin 분기 검증 추가.

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: { user: { update: jest.Mock; findUnique: jest.Mock } };
  let jwtMock: { sign: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      user: { update: jest.fn(), findUnique: jest.fn() },
    };
    jwtMock = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
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

  // Cycle L1 (feature/ldh) — 로컬 로그인 분기.
  describe('localLogin', () => {
    const localUser = {
      id: 'u2',
      username: 'admin',
      name: 'Admin',
      department: 'IT',
      role: 'ADMIN',
      createdAt: new Date('2026-06-02T00:00:00Z'),
      showPersonalSpaceInSidebar: false,
      // 실제 bcrypt 해시 — 'correct-pass' 로 생성.
      passwordHash: bcrypt.hashSync('correct-pass', 10),
    };

    it('returns sanitized user + token on correct password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(localUser);
      const result = await service.localLogin('admin', 'correct-pass');
      expect(result.token).toBe('signed.jwt.token');
      // sanitize 결과에 passwordHash 가 빠져 있어야 한다.
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).toMatchObject({
        id: 'u2',
        username: 'admin',
        role: 'ADMIN',
      });
      // 토큰 페이로드는 {sub, username, role}.
      expect(jwtMock.sign).toHaveBeenCalledWith({
        sub: 'u2',
        username: 'admin',
        role: 'ADMIN',
      });
    });

    it('throws 400 (SSO only) when account has no passwordHash', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...localUser,
        passwordHash: null,
      });
      await expect(service.localLogin('admin', 'whatever')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws 401 on wrong password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(localUser);
      await expect(service.localLogin('admin', 'wrong-pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 401 when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.localLogin('ghost', 'x')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
