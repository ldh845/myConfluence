import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 49 — AuthService.updateMyPrefs 단위 검증.
// Cycle L1 (feature/ldh) — localLogin 분기 검증 추가.
// Cycle L3 (feature/ldh) — 로그인 실패 잠금 + 셀프 비번 변경 검증 추가.

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
      isActive: true,
      passwordHash: null,
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
        isActive: true,
        hasLocalPassword: false,
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
      isActive: true,
      showPersonalSpaceInSidebar: false,
      // Cycle L3 — 잠금 상태 필드.
      failedLoginCount: 0,
      lockedUntil: null as Date | null,
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

    // Cycle L2 (feature/ldh) — 비활성 계정은 비번이 맞아도 거부.
    it('throws 401 when account is deactivated (isActive=false)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...localUser,
        isActive: false,
      });
      await expect(
        service.localLogin('admin', 'correct-pass'),
      ).rejects.toThrow(UnauthorizedException);
    });

    // Cycle L3 (feature/ldh) — brute-force 잠금.
    it('increments failedLoginCount on wrong password (below threshold)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...localUser,
        failedLoginCount: 1,
      });
      await expect(service.localLogin('admin', 'wrong-pass')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { failedLoginCount: 2 },
      });
    });

    it('locks account on 5th consecutive wrong password (423)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...localUser,
        failedLoginCount: 4, // 다음 오답이 5회째
      });
      await expect(
        service.localLogin('admin', 'wrong-pass'),
      ).rejects.toMatchObject({ status: HttpStatus.LOCKED });
      // 잠금 설정 + 카운트 리셋.
      const arg = prismaMock.user.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'u2' });
      expect(arg.data.failedLoginCount).toBe(0);
      expect(arg.data.lockedUntil).toBeInstanceOf(Date);
    });

    it('rejects with 423 when already locked (no password check)', async () => {
      const future = new Date(Date.now() + 5 * 60 * 1000);
      prismaMock.user.findUnique.mockResolvedValue({
        ...localUser,
        lockedUntil: future,
      });
      await expect(
        service.localLogin('admin', 'correct-pass'),
      ).rejects.toBeInstanceOf(HttpException);
      await expect(
        service.localLogin('admin', 'correct-pass'),
      ).rejects.toMatchObject({ status: HttpStatus.LOCKED });
      // 잠긴 동안엔 update 없음.
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('allows login after lockedUntil has expired and resets counters', async () => {
      const past = new Date(Date.now() - 60 * 1000);
      prismaMock.user.findUnique.mockResolvedValue({
        ...localUser,
        failedLoginCount: 0,
        lockedUntil: past,
      });
      const result = await service.localLogin('admin', 'correct-pass');
      expect(result.token).toBe('signed.jwt.token');
      // 만료 잠금 흔적 리셋.
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    });

    it('resets failedLoginCount on successful login', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...localUser,
        failedLoginCount: 3,
      });
      await service.localLogin('admin', 'correct-pass');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    });
  });

  // Cycle L3 (feature/ldh) — 셀프 비밀번호 변경.
  describe('changeMyPassword', () => {
    const localUser = {
      id: 'u2',
      username: 'admin',
      passwordHash: bcrypt.hashSync('current-pass', 10),
    };

    it('updates hash when current matches and new passes policy', async () => {
      prismaMock.user.findUnique.mockResolvedValue(localUser);
      const result = await service.changeMyPassword(
        'u2',
        'current-pass',
        'newpass123',
      );
      expect(result).toEqual({ ok: true });
      const arg = prismaMock.user.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'u2' });
      expect(typeof arg.data.passwordHash).toBe('string');
      expect(arg.data.passwordHash).not.toBe('newpass123'); // 해시됨
    });

    it('throws 401 when current password is wrong', async () => {
      prismaMock.user.findUnique.mockResolvedValue(localUser);
      await expect(
        service.changeMyPassword('u2', 'wrong-current', 'newpass123'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('throws 400 (SSO only) when account has no passwordHash', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...localUser,
        passwordHash: null,
      });
      await expect(
        service.changeMyPassword('u2', 'whatever', 'newpass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when new password violates policy', async () => {
      prismaMock.user.findUnique.mockResolvedValue(localUser);
      await expect(
        service.changeMyPassword('u2', 'current-pass', 'short'),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });
});
