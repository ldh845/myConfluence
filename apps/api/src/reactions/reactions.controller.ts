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
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReactionsService } from './reactions.service';

class ToggleReactionDto {
  @IsString() emoji!: string;
  @IsOptional() @IsString() pageId?: string;
  @IsOptional() @IsString() commentId?: string;
}

// FR-073 (Cycle 25) — 빈 prefix. /reactions/toggle + /pages/:id/reactions + /comments/:id/reactions.
// FR-001 (Cycle 27e) — toggle는 JwtAuthGuard. GET은 public 유지.
@Controller()
export class ReactionsController {
  constructor(private readonly reactions: ReactionsService) {}

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
  listByPage(@Param('id') id: string) {
    return this.reactions.listByPage(id);
  }

  @Get('comments/:id/reactions')
  listByComment(@Param('id') id: string) {
    return this.reactions.listByComment(id);
  }
}
