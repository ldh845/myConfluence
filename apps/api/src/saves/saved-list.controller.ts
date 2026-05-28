import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SavesService } from './saves.service';

// Cycle 69 — 내 저장 페이지 목록. SavesController(pages/:id/save) 와 route
// prefix 가 달라 별도 컨트롤러로 분리. GET /api/saves → 홈 '나중을 위해 저장' 뷰.
@Controller('saves')
@UseGuards(JwtAuthGuard)
export class SavedListController {
  constructor(private readonly saves: SavesService) {}

  @Get()
  list(@Req() req: Request) {
    return this.saves.listSaved(req.user!.id);
  }
}
