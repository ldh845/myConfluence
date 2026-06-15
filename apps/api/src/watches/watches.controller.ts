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
import {
  SpacePermissionService,
  type Actor,
} from '../spaces/space-permission.service';

// Cycle 53 — '지켜보기' 토글 API.
// 모든 라우트 JwtAuthGuard. SavesController 와 동일 패턴.
function userFromReq(req: Request): Actor {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}

@Controller('pages/:id/watch')
@UseGuards(JwtAuthGuard)
export class WatchesController {
  constructor(
    private readonly watches: WatchesService,
    // Cycle L5-2 — watch 등록 시 페이지 읽기 권한 확인.
    private readonly perms: SpacePermissionService,
  ) {}

  @Get()
  async get(@Param('id') pageId: string, @Req() req: Request) {
    const watching = await this.watches.isWatching(req.user!.id, pageId);
    return { watching };
  }

  // Cycle L5-2 정책 7 — 지켜보기 등록은 '페이지 읽기 권한'(접근 불가 페이지 watch 차단).
  @Post()
  @HttpCode(200)
  async create(@Param('id') pageId: string, @Req() req: Request) {
    await this.perms.assertCanViewPage(pageId, userFromReq(req));
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
