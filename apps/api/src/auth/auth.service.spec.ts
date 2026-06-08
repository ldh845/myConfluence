import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentGroupService } from '../department/department-group.service';

// Cycle L10 — AuthService 가 DepartmentGroupService 를 주입받는다(로그인 시 부서 그룹).
//   로그인 분기 검증에서는 no-op 모킹(부서 동기화 로직은 별도 spec).
const deptGroupsMock = {
  syncUserDepartmentGroup: jest.fn().mockResolvedValue(undefined),
  resolveOrCreateDepartmentGroup: jest.fn().mockResolvedValue(null),
};

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
        { provide: DepartmentGroupService, useValue: deptGroupsMock },
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

// Cycle L8 (feature/ldh) — findOrCreateOidcUser 의 Keycloak 그룹 동기화.
//   규칙: undefined→스킵 / []→KEYCLOAK 멤버십 전부 제거 / 그룹명 upsert(KEYCLOAK) /
//   동명 LOCAL 스킵 / LOCAL 멤버십 불가침 / 동기화 실패해도 로그인 성공(best-effort).
describe('AuthService — Keycloak 그룹 동기화 (Cycle L8)', () => {
  let service: AuthService;
  let prismaMock: {
    user: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    group: { findUnique: jest.Mock; create: jest.Mock };
    groupMember: {
      findMany: jest.Mock;
      createMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  // sanitize 가 요구하는 전체 필드를 갖춘 활성 사용자(매핑은 bySub 경로로 진입).
  const ACTIVE = {
    id: 'u1',
    username: 'testuser2',
    name: 'Test User2',
    department: '',
    role: 'DEVELOPER',
    createdAt: new Date('2026-01-01'),
    isActive: true,
    passwordHash: null,
    keycloakId: 'sub-2',
    showPersonalSpaceInSidebar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(ACTIVE), // bySub 히트
        update: jest.fn().mockResolvedValue(ACTIVE),
        create: jest.fn(),
      },
      group: { findUnique: jest.fn(), create: jest.fn() },
      groupMember: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: DepartmentGroupService, useValue: deptGroupsMock },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    // 로그 노이즈 억제(경고/에러는 동작 검증으로 대체).
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  const call = (groups?: string[]) =>
    service.findOrCreateOidcUser({ sub: 'sub-2', username: 'testuser2', groups });

  it('claim 그룹이 없으면(undefined) 동기화 스킵 — 멤버십 보존', async () => {
    await call(undefined);
    expect(prismaMock.group.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.groupMember.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('미존재 그룹은 source=KEYCLOAK 로 자동 생성 + 멤버십 추가', async () => {
    prismaMock.group.findUnique.mockResolvedValue(null);
    prismaMock.group.create.mockResolvedValue({
      id: 'g1',
      name: 'dev-team1',
      source: 'KEYCLOAK',
    });
    await call(['dev-team1']);
    expect(prismaMock.group.create).toHaveBeenCalledWith({
      data: { name: 'dev-team1', source: 'KEYCLOAK' },
    });
    expect(prismaMock.groupMember.createMany).toHaveBeenCalledWith({
      data: [{ groupId: 'g1', userId: 'u1' }],
    });
  });

  it('KEYCLOAK 멤버십을 claim 집합과 정렬(추가+제거 동시)', async () => {
    // 기존 KEYCLOAK 멤버십 g-old, claim 은 dev-team1(=g1, 기존 KEYCLOAK 그룹).
    prismaMock.groupMember.findMany.mockResolvedValue([{ groupId: 'g-old' }]);
    prismaMock.group.findUnique.mockResolvedValue({
      id: 'g1',
      name: 'dev-team1',
      source: 'KEYCLOAK',
    });
    await call(['dev-team1']);
    expect(prismaMock.group.create).not.toHaveBeenCalled();
    expect(prismaMock.groupMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', groupId: { in: ['g-old'] } },
    });
    expect(prismaMock.groupMember.createMany).toHaveBeenCalledWith({
      data: [{ groupId: 'g1', userId: 'u1' }],
    });
  });

  it('빈 배열([]) → KEYCLOAK 멤버십 전부 제거', async () => {
    prismaMock.groupMember.findMany.mockResolvedValue([
      { groupId: 'g-a' },
      { groupId: 'g-b' },
    ]);
    await call([]);
    expect(prismaMock.groupMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', groupId: { in: ['g-a', 'g-b'] } },
    });
    expect(prismaMock.groupMember.createMany).not.toHaveBeenCalled();
  });

  it('동명 LOCAL 그룹은 스킵 — 생성·멤버 주입 안 함', async () => {
    prismaMock.group.findUnique.mockResolvedValue({
      id: 'gL',
      name: '개발1팀',
      source: 'LOCAL',
    });
    await call(['개발1팀']);
    expect(prismaMock.group.create).not.toHaveBeenCalled();
    expect(prismaMock.groupMember.createMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('현재 멤버십 조회는 KEYCLOAK source 만(LOCAL 불가침)', async () => {
    prismaMock.group.findUnique.mockResolvedValue(null);
    prismaMock.group.create.mockResolvedValue({
      id: 'g1',
      name: 'dev-team1',
      source: 'KEYCLOAK',
    });
    await call(['dev-team1']);
    expect(prismaMock.groupMember.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', group: { source: 'KEYCLOAK' } },
      select: { groupId: true },
    });
  });

  it('동기화가 실패해도 로그인은 성공(best-effort)', async () => {
    prismaMock.group.findUnique.mockRejectedValue(new Error('db down'));
    const user = await call(['dev-team1']);
    expect(user.username).toBe('testuser2');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

// Cycle L10 (feature/ldh) — findOrCreateOidcUser 의 부서 연동:
//   department claim → User.department 갱신 + deptGroups.syncUserDepartmentGroup 호출.
describe('AuthService — 부서 그룹 자동 배정 연동 (Cycle L10)', () => {
  let service: AuthService;
  let prismaMock: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let deptMock: { syncUserDepartmentGroup: jest.Mock };

  const ACTIVE = {
    id: 'u1',
    username: 'testuser2',
    name: 'Test User2',
    department: '',
    role: 'DEVELOPER',
    createdAt: new Date('2026-01-01'),
    isActive: true,
    passwordHash: null,
    keycloakId: 'sub-2',
    showPersonalSpaceInSidebar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(ACTIVE), // bySub 히트
        update: jest.fn().mockResolvedValue(ACTIVE),
      },
    };
    deptMock = { syncUserDepartmentGroup: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: DepartmentGroupService, useValue: deptMock },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('department claim 있음 → User.department 갱신 + 부서 동기화 호출', async () => {
    prismaMock.user.update.mockResolvedValue({ ...ACTIVE, department: '플랫폼' });
    await service.findOrCreateOidcUser({
      sub: 'sub-2',
      username: 'testuser2',
      department: '플랫폼',
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ department: '플랫폼' }),
      }),
    );
    expect(deptMock.syncUserDepartmentGroup).toHaveBeenCalledWith('u1', '플랫폼');
  });

  it('department claim 없음 → update 에 department 키 없음(기존 보존)', async () => {
    await service.findOrCreateOidcUser({ sub: 'sub-2', username: 'testuser2' });
    const data = prismaMock.user.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('department');
    // 기존 department('')로 동기화 호출(서비스가 빈값이면 내부에서 스킵).
    expect(deptMock.syncUserDepartmentGroup).toHaveBeenCalledWith('u1', '');
  });
});
