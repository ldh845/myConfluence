import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

// FR-120 (Cycle 23) — 페이지 공유 링크.
// 토큰 = 16 bytes hex (32자). 한 페이지에 활성 토큰 최대 1개 정책.
// "새 링크 발급" = 기존 활성 토큰 revoke + 새로 생성.
// FR-001 (Cycle 27d) — createdById = JWT user.id. 응답에 createdBy join.

const CREATOR_SELECT = {
  id: true,
  username: true,
  name: true,
  department: true,
  role: true,
} as const;

@Injectable()
export class PageSharesService {
  constructor(private readonly prisma: PrismaService) {}

  // 활성 토큰이 있으면 그대로, 없으면 신규.
  async getOrCreate(pageId: string, userId: string | null) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: { id: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });

    const existing = await this.prisma.pageShare.findFirst({
      where: { pageId, revokedAt: null },
      include: { createdBy: { select: CREATOR_SELECT } },
    });
    if (existing) return existing;

    return this.prisma.pageShare.create({
      data: {
        pageId,
        token: randomBytes(16).toString('hex'),
        createdById: userId ?? null,
      },
      include: { createdBy: { select: CREATOR_SELECT } },
    });
  }

  // 기존 활성 토큰 revoke + 새 토큰 발급. dialog "🔄 새 링크 발급" 용.
  async rotate(pageId: string, userId: string | null) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: { id: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });

    return this.prisma.$transaction(async (tx) => {
      await tx.pageShare.updateMany({
        where: { pageId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return tx.pageShare.create({
        data: {
          pageId,
          token: randomBytes(16).toString('hex'),
          createdById: userId ?? null,
        },
        include: { createdBy: { select: CREATOR_SELECT } },
      });
    });
  }

  // 모든 활성 토큰 revoke. idempotent.
  async revoke(pageId: string) {
    await this.prisma.pageShare.updateMany({
      where: { pageId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  // 공유 페이지 진입용. 토큰/revoke/deletedAt 검사는 호출자가 분기.
  async findByToken(token: string) {
    return this.prisma.pageShare.findUnique({
      where: { token },
      include: {
        page: {
          select: {
            id: true,
            title: true,
            content: true,
            deletedAt: true,
            spaceId: true,
            space: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  // 공유 첨부 다운로드 검증 — 토큰 활성 + 페이지 활성 + 첨부의 pageId 일치.
  async validateAttachmentAccess(token: string, attachmentId: string) {
    const share = await this.prisma.pageShare.findUnique({
      where: { token },
      select: {
        revokedAt: true,
        pageId: true,
        page: { select: { deletedAt: true } },
      },
    });
    if (!share) throw new NotFoundException({ error: 'share not found' });
    if (share.revokedAt) {
      throw new BadRequestException({ error: 'share revoked' });
    }
    if (share.page.deletedAt) {
      throw new BadRequestException({ error: 'page deleted' });
    }
    const att = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!att) throw new NotFoundException({ error: 'attachment not found' });
    if (att.pageId !== share.pageId) {
      throw new NotFoundException({ error: 'attachment not on this page' });
    }
    return att;
  }
}
