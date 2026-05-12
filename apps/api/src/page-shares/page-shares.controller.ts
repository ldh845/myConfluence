import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { PageSharesService } from './page-shares.service';

// FR-120 (Cycle 23) — 페이지 공유 라우트.
// 빈 prefix 패턴 (AttachmentsController와 동일) — 두 개 path group을 한 컨트롤러에서.

@Controller()
export class PageSharesController {
  constructor(
    private readonly shares: PageSharesService,
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Post('pages/:id/share')
  @HttpCode(200)
  create(@Param('id') id: string) {
    return this.shares.getOrCreate(id);
  }

  @Post('pages/:id/share/rotate')
  @HttpCode(200)
  rotate(@Param('id') id: string) {
    return this.shares.rotate(id);
  }

  @Delete('pages/:id/share')
  @HttpCode(200)
  revoke(@Param('id') id: string) {
    return this.shares.revoke(id);
  }

  // 공유 페이지 본문 조회.
  // 404 = 토큰 없음, 410 = revoked / page deleted, 200 = 정상.
  @Get('share/:token')
  async view(@Param('token') token: string) {
    const share = await this.shares.findByToken(token);
    if (!share) throw new NotFoundException({ error: 'share not found' });
    if (share.revokedAt) {
      throw new HttpException(
        { error: 'share revoked' },
        HttpStatus.GONE,
      );
    }
    if (share.page.deletedAt) {
      throw new HttpException(
        { error: 'page deleted' },
        HttpStatus.GONE,
      );
    }
    const [diagrams, attachments] = await Promise.all([
      this.prisma.diagram.findMany({
        where: { pageId: share.pageId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.attachment.findMany({
        where: { pageId: share.pageId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          filename: true,
          mimetype: true,
          size: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      page: {
        id: share.page.id,
        title: share.page.title,
        content: share.page.content,
        spaceName: share.page.space?.name ?? null,
      },
      diagrams,
      attachments,
    };
  }

  // 공유 첨부 다운로드 — 토큰 + revoke + 페이지 일치 검증 후 stream.
  @Get('share/:token/attachments/:attachmentId')
  async downloadAttachment(
    @Param('token') token: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    let att;
    try {
      att = await this.shares.validateAttachmentAccess(token, attachmentId);
    } catch (e) {
      if (e instanceof BadRequestException) {
        res.status(HttpStatus.GONE).json(e.getResponse());
        return;
      }
      throw e;
    }
    res.setHeader('Content-Type', att.mimetype);
    res.setHeader('Content-Length', String(att.size));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
    );
    const stream = this.attachments.createReadStream(att.storageKey);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500);
      res.end();
    });
    stream.pipe(res);
  }
}
