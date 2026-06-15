import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ResolveCommentDto } from './dto/resolve-comment.dto';
import {
  SpacePermissionService,
  type Actor,
} from '../spaces/space-permission.service';

// FR-070 (Cycle 16-1a) — Attachments 패턴과 동일하게 두 prefix(pages/.../comments
// + comments/:id)를 한 컨트롤러에서 처리. @Controller() 빈 prefix.
// FR-001 (Cycle 27d) — mutation 라우트는 JwtAuthGuard. GET은 public 유지.
function actorFromReq(req: Request): { id: string; name: string } | null {
  return req.user ? { id: req.user.id, name: req.user.name } : null;
}

// Cycle L5 — 권한 판정용 actor(role 포함).
function userFromReq(req: Request): Actor {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}

@Controller()
export class CommentsController {
  constructor(
    private readonly comments: CommentsService,
    // Cycle L5 — 댓글 목록 읽기 권한. Cycle L5-2 — 작성/수정/삭제/resolve 쓰기 권한 적용.
    private readonly perms: SpacePermissionService,
  ) {}

  // Cycle L5-2 정책 1 — 댓글 작성은 '페이지 읽기 권한'(뷰어도 댓글 가능).
  @Post('pages/:pageId/comments')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('pageId') pageId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ) {
    await this.perms.assertCanViewPage(pageId, userFromReq(req));
    return this.comments.create(pageId, dto, actorFromReq(req));
  }

  // Cycle L5 — 댓글 목록도 페이지 읽기 권한 필수(비공개/제한 페이지 댓글 누수 차단).
  @Get('pages/:pageId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  async listByPage(@Param('pageId') pageId: string, @Req() req: Request) {
    await this.perms.assertCanViewPage(pageId, userFromReq(req));
    return this.comments.listByPage(pageId);
  }

  // Cycle L5-2 정책 2 — 댓글 수정은 '본인만'. 공간 관리자·전역 ADMIN 도 불가
  //   (타인 댓글 내용 조작 방지). 작성자 불일치 시 403.
  @Patch('comments/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @Req() req: Request,
  ) {
    const actor = userFromReq(req);
    const ctx = await this.comments.getContext(id);
    if (!actor || ctx.authorId !== actor.id) {
      throw new ForbiddenException({ error: 'not comment author' });
    }
    return this.comments.update(id, dto);
  }

  // Cycle L5-2 정책 3 — 댓글 삭제는 '본인 OR 공간 관리(assertCanManage, 전역 ADMIN 포함)'.
  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const actor = userFromReq(req);
    const ctx = await this.comments.getContext(id);
    const isAuthor = !!actor && ctx.authorId === actor.id;
    if (!isAuthor) {
      // 본인이 아니면 공간 관리 권한 필요(없으면 assertCanManage 가 403).
      await this.perms.assertCanManage(ctx.spaceId, actor);
    }
    return this.comments.remove(id);
  }

  // FR-071 (Cycle 16-3a) — 인라인 댓글 해결/해결 취소. RESTful 200으로 통일.
  // Cycle L5-2 정책 4 — resolve 는 '페이지 편집 권한'.
  @Post('comments/:id/resolve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async resolve(
    @Param('id') id: string,
    @Body() _dto: ResolveCommentDto,
    @Req() req: Request,
  ) {
    const ctx = await this.comments.getContext(id);
    await this.perms.assertCanEditPage(ctx.pageId, userFromReq(req));
    return this.comments.resolve(id, actorFromReq(req));
  }

  // Cycle L5-2 정책 5 — unresolve 도 '페이지 편집 권한'.
  @Post('comments/:id/unresolve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async unresolve(@Param('id') id: string, @Req() req: Request) {
    const ctx = await this.comments.getContext(id);
    await this.perms.assertCanEditPage(ctx.pageId, userFromReq(req));
    return this.comments.unresolve(id);
  }
}
