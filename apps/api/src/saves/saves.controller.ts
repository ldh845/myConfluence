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
import { SavesService } from './saves.service';

// Cycle 53 — '나중을 위해 저장' 토글 API.
// 모든 라우트 JwtAuthGuard — 본인 데이터. 비-로그인 시 401.
@Controller('pages/:id/save')
@UseGuards(JwtAuthGuard)
export class SavesController {
  constructor(private readonly saves: SavesService) {}

  // 저장 상태 — 클라이언트가 현재 토글 상태 표시용.
  @Get()
  async get(@Param('id') pageId: string, @Req() req: Request) {
    const saved = await this.saves.isSaved(req.user!.id, pageId);
    return { saved };
  }

  // 저장 (idempotent: 이미 있으면 no-op).
  @Post()
  @HttpCode(200)
  async create(@Param('id') pageId: string, @Req() req: Request) {
    await this.saves.save(req.user!.id, pageId);
    return { saved: true };
  }

  // 해제 (idempotent: 없어도 무해).
  @Delete()
  @HttpCode(200)
  async remove(@Param('id') pageId: string, @Req() req: Request) {
    await this.saves.unsave(req.user!.id, pageId);
    return { saved: false };
  }
}
