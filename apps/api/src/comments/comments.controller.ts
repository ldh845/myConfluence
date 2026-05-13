import {
  Body,
  Controller,
  Delete,
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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ResolveCommentDto } from './dto/resolve-comment.dto';

// FR-070 (Cycle 16-1a) — Attachments 패턴과 동일하게 두 prefix(pages/.../comments
// + comments/:id)를 한 컨트롤러에서 처리. @Controller() 빈 prefix.
// FR-001 (Cycle 27d) — mutation 라우트는 JwtAuthGuard. GET은 public 유지.
function actorFromReq(req: Request): { id: string; name: string } | null {
  return req.user ? { id: req.user.id, name: req.user.name } : null;
}

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post('pages/:pageId/comments')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('pageId') pageId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ) {
    return this.comments.create(pageId, dto, actorFromReq(req));
  }

  @Get('pages/:pageId/comments')
  listByPage(@Param('pageId') pageId: string) {
    return this.comments.listByPage(pageId);
  }

  @Patch('comments/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateCommentDto) {
    return this.comments.update(id, dto);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.comments.remove(id);
  }

  // FR-071 (Cycle 16-3a) — 인라인 댓글 해결/해결 취소. RESTful 200으로 통일.
  @Post('comments/:id/resolve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  resolve(
    @Param('id') id: string,
    @Body() _dto: ResolveCommentDto,
    @Req() req: Request,
  ) {
    return this.comments.resolve(id, actorFromReq(req));
  }

  @Post('comments/:id/unresolve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  unresolve(@Param('id') id: string) {
    return this.comments.unresolve(id);
  }
}
