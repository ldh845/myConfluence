import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { ReactionsService } from './reactions.service';

class ToggleReactionDto {
  @IsString() emoji!: string;
  @IsString() reactorId!: string;
  @IsOptional() @IsString() reactorName?: string;
  @IsOptional() @IsString() pageId?: string;
  @IsOptional() @IsString() commentId?: string;
}

// FR-073 (Cycle 25) — 빈 prefix. /reactions/toggle + /pages/:id/reactions + /comments/:id/reactions.
@Controller()
export class ReactionsController {
  constructor(private readonly reactions: ReactionsService) {}

  @Post('reactions/toggle')
  @HttpCode(200)
  toggle(@Body() dto: ToggleReactionDto) {
    return this.reactions.toggle(dto);
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
