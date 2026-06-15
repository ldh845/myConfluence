import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle L6 (feature/ldh) — GroupsService 단위 검증 (PrismaService mock).
//   CRUD(중복 409) / 멤버 추가·제거(idempotent) / KEYCLOAK source 보호 가드(403).

describe('GroupsService', () => {
  let service: GroupsService;
  let prismaMock: {
    group: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    groupMember: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prismaMock = {
      group: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      groupMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findUnique: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<GroupsService>(GroupsService);
  });

  const LOCAL = { id: 'g1', name: '개발팀', source: 'LOCAL' };
  const KC = { id: 'g2', name: 'kc-team', source: 'KEYCLOAK' };

  describe('list', () => {
    it('멤버 수를 memberCount 로 평탄화', async () => {
      prismaMock.group.findMany.mockResolvedValue([
        { id: 'g1', name: '개발팀', source: 'LOCAL', _count: { members: 3 } },
      ]);
      const r = await service.list();
      expect(r[0]).toMatchObject({ id: 'g1', memberCount: 3 });
      expect(r[0]).not.toHaveProperty('_count');
    });
  });

  describe('create', () => {
    it('정상 생성(LOCAL 기본)', async () => {
      prismaMock.group.findUnique.mockResolvedValue(null);
      prismaMock.group.create.mockResolvedValue({ id: 'g1', name: '개발팀' });
      await service.create({ name: '  개발팀  ', description: ' 설명 ' });
      expect(prismaMock.group.create).toHaveBeenCalledWith({
        data: { name: '개발팀', description: '설명' },
      });
    });

    it('이름 중복 → 409', async () => {
      prismaMock.group.findUnique.mockResolvedValue({ id: 'x' });
      await expect(service.create({ name: '개발팀' })).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.group.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('KEYCLOAK 그룹 수정 → 403', async () => {
      prismaMock.group.findUnique.mockResolvedValue(KC);
      await expect(service.update('g2', { name: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.group.update).not.toHaveBeenCalled();
    });

    it('이름 변경 시 중복 → 409', async () => {
      // 1st findUnique = loadLocal(by id), 2nd = name 중복 검사.
      prismaMock.group.findUnique
        .mockResolvedValueOnce(LOCAL)
        .mockResolvedValueOnce({ id: 'other' });
      await expect(service.update('g1', { name: '인프라팀' })).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.group.update).not.toHaveBeenCalled();
    });

    it('정상 수정', async () => {
      prismaMock.group.findUnique
        .mockResolvedValueOnce(LOCAL)
        .mockResolvedValueOnce(null);
      prismaMock.group.update.mockResolvedValue({ id: 'g1' });
      await service.update('g1', { name: '인프라팀', description: '' });
      expect(prismaMock.group.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: { name: '인프라팀', description: null },
      });
    });
  });

  describe('remove', () => {
    it('KEYCLOAK 그룹 삭제 → 403', async () => {
      prismaMock.group.findUnique.mockResolvedValue(KC);
      await expect(service.remove('g2')).rejects.toThrow(ForbiddenException);
      expect(prismaMock.group.delete).not.toHaveBeenCalled();
    });

    it('LOCAL 그룹 삭제 → delete 호출', async () => {
      prismaMock.group.findUnique.mockResolvedValue(LOCAL);
      const r = await service.remove('g1');
      expect(prismaMock.group.delete).toHaveBeenCalledWith({
        where: { id: 'g1' },
      });
      expect(r).toEqual({ ok: true });
    });

    it('미존재 그룹 → 404', async () => {
      prismaMock.group.findUnique.mockResolvedValue(null);
      await expect(service.remove('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMember', () => {
    it('KEYCLOAK 그룹 → 403', async () => {
      prismaMock.group.findUnique.mockResolvedValue(KC);
      await expect(service.addMember('g2', 'u1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.groupMember.create).not.toHaveBeenCalled();
    });

    it('대상 사용자 없으면 → 404', async () => {
      prismaMock.group.findUnique.mockResolvedValue(LOCAL);
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.addMember('g1', 'ghost')).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.groupMember.create).not.toHaveBeenCalled();
    });

    it('신규 멤버 → create 호출, alreadyMember=false', async () => {
      prismaMock.group.findUnique.mockResolvedValue(LOCAL);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
      prismaMock.groupMember.findUnique.mockResolvedValue(null);
      const r = await service.addMember('g1', 'u1');
      expect(prismaMock.groupMember.create).toHaveBeenCalledWith({
        data: { groupId: 'g1', userId: 'u1' },
      });
      expect(r).toEqual({ ok: true, alreadyMember: false });
    });

    it('이미 멤버 → idempotent(create 안 함), alreadyMember=true', async () => {
      prismaMock.group.findUnique.mockResolvedValue(LOCAL);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
      prismaMock.groupMember.findUnique.mockResolvedValue({ groupId: 'g1' });
      const r = await service.addMember('g1', 'u1');
      expect(prismaMock.groupMember.create).not.toHaveBeenCalled();
      expect(r).toEqual({ ok: true, alreadyMember: true });
    });
  });

  describe('removeMember', () => {
    it('KEYCLOAK 그룹 → 403', async () => {
      prismaMock.group.findUnique.mockResolvedValue(KC);
      await expect(service.removeMember('g2', 'u1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.groupMember.deleteMany).not.toHaveBeenCalled();
    });

    it('LOCAL 그룹 → deleteMany(멤버 아니어도 무해)', async () => {
      prismaMock.group.findUnique.mockResolvedValue(LOCAL);
      const r = await service.removeMember('g1', 'u1');
      expect(prismaMock.groupMember.deleteMany).toHaveBeenCalledWith({
        where: { groupId: 'g1', userId: 'u1' },
      });
      expect(r).toEqual({ ok: true });
    });
  });

  describe('listMembers', () => {
    it('user 평탄화 + joinedAt', async () => {
      prismaMock.group.findUnique.mockResolvedValue(LOCAL);
      const joinedAt = new Date();
      prismaMock.groupMember.findMany.mockResolvedValue([
        { createdAt: joinedAt, user: { id: 'u1', name: 'Kim' } },
      ]);
      const r = await service.listMembers('g1');
      expect(r[0]).toEqual({ id: 'u1', name: 'Kim', joinedAt });
    });
  });
});
