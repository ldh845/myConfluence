import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WatchesService } from './watches.service';

// Cycle 53 — '지켜보기' 토글 API.
// 모든 라우트 JwtAuthGuard. SavesController 와 동일 패턴.
@Controller('pages/:id/watch')
@UseGuards(JwtAuthGuard)
export class WatchesController {
  constructor(private readonly watches: WatchesService) {}

  @Get()
  async get(@Param('id') pageId: string, @Req() req: Request) {
    const watching = await this.watches.isWatching(req.user!.id, pageId);
    return { watching };
  }

  @Post()
  @HttpCode(200)
  async create(@Param('id') pageId: string, @Req() req: Request) {
    await this.watches.watch(req.user!.id, pageId);
    return { watching: true };
  }

  @Delete()
  @HttpCode(200)
  async remove(@Param('id') pageId: string, @Req() req: Request) {
    await this.watches.unwatch(req.user!.id, pageId);
    return { watching: false };
  }
}
