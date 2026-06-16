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
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { PageSharesService } from './page-shares.service';
import {
  SpacePermissionService,
  type Actor,
} from '../spaces/space-permission.service';

// FR-120 (Cycle 23) — 페이지 공유 라우트.
// 빈 prefix 패턴 (AttachmentsController와 동일) — 두 개 path group을 한 컨트롤러에서.
function userFromReq(req: Request): Actor {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}

@Controller()
export class PageSharesController {
  constructor(
    private readonly shares: PageSharesService,
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
    // Cycle L5-2 — 공유 발급/회전/취소는 페이지 편집 권한자만.
    private readonly perms: SpacePermissionService,
  ) {}

  // FR-001 (Cycle 27d) — 발급 라우트는 인증 필수. createdById는 JWT user.id.
  // Cycle L5-2 정책 8 — 공유 링크 발급은 '페이지 편집 권한'(비편집자 외부 공개 차단).
  @Post('pages/:id/share')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async create(@Param('id') id: string, @Req() req: Request) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.shares.getOrCreate(id, req.user?.id ?? null);
  }

  // Cycle L5-2 정책 9 — 공유 토큰 회전도 '페이지 편집 권한'.
  @Post('pages/:id/share/rotate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async rotate(@Param('id') id: string, @Req() req: Request) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.shares.rotate(id, req.user?.id ?? null);
  }

  // Cycle L5-2 정책 10 — 공유 취소도 '페이지 편집 권한'.
  @Delete('pages/:id/share')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async revoke(@Param('id') id: string, @Req() req: Request) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
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
