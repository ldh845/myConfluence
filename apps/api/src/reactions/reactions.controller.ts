import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ReactionsService } from './reactions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SpacePermissionService,
  type Actor,
} from '../spaces/space-permission.service';

class ToggleReactionDto {
  @IsString() emoji!: string;
  @IsOptional() @IsString() pageId?: string;
  @IsOptional() @IsString() commentId?: string;
}

// Cycle L5 — 권한 판정용 actor(role 포함).
function userFromReq(req: Request): Actor {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}

// FR-073 (Cycle 25) — 빈 prefix. /reactions/toggle + /pages/:id/reactions + /comments/:id/reactions.
// FR-001 (Cycle 27e) — toggle는 JwtAuthGuard.
// Cycle L5 — GET 목록도 페이지 읽기 권한 적용(비공개/제한 페이지 리액션·반응자 누수 차단).
//   (toggle 의 공간/페이지 권한 검사는 정책 검토 후 L5-2 에서 보강.)
@Controller()
export class ReactionsController {
  constructor(
    private readonly reactions: ReactionsService,
    private readonly perms: SpacePermissionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('reactions/toggle')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  toggle(@Body() dto: ToggleReactionDto, @Req() req: Request) {
    return this.reactions.toggle({
      pageId: dto.pageId,
      commentId: dto.commentId,
      emoji: dto.emoji,
      userId: req.user!.id,
    });
  }

  @Get('pages/:id/reactions')
  @UseGuards(OptionalJwtAuthGuard)
  async listByPage(@Param('id') id: string, @Req() req: Request) {
    await this.perms.assertCanViewPage(id, userFromReq(req));
    return this.reactions.listByPage(id);
  }

  @Get('comments/:id/reactions')
  @UseGuards(OptionalJwtAuthGuard)
  async listByComment(@Param('id') id: string, @Req() req: Request) {
    // 댓글 → 소속 페이지 해석 후 그 페이지 읽기 권한을 따른다.
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: { pageId: true },
    });
    if (!comment) throw new NotFoundException({ error: 'comment not found' });
    await this.perms.assertCanViewPage(comment.pageId, userFromReq(req));
    return this.reactions.listByComment(id);
  }
}
