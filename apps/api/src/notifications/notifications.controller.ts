import {
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

// Cycle 59 — 알림 API. 모두 본인 데이터 (JwtAuthGuard).
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // GET /notifications?limit=30 — 본인 최근 알림 + unreadCount.
  @Get()
  list(@Req() req: Request, @Query('limit') limit?: string) {
    return this.notifications.listForUser(req.user!.id, {
      limit: limit ? Number(limit) : 30,
    });
  }

  // PATCH /notifications/:id/read — 단건 읽음 (본인 소유만, idempotent).
  @Patch(':id/read')
  @HttpCode(200)
  async markRead(@Param('id') id: string, @Req() req: Request) {
    await this.notifications.markRead(req.user!.id, id);
    return { ok: true };
  }

  // PATCH /notifications/read-all — 전부 읽음.
  @Patch('read-all')
  @HttpCode(200)
  async markAllRead(@Req() req: Request) {
    await this.notifications.markAllRead(req.user!.id);
    return { ok: true };
  }
}
