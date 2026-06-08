import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from './auth.service';
import {
  ApiTokenService,
  ApiTokenView,
  IssuedApiToken,
} from './api-token.service';
import { CookieAuthGuard } from './cookie-auth.guard';
import { CreateApiTokenDto } from './dto/create-api-token.dto';

// Cycle L-API-1 (feature/ldh) — 본인 API 토큰 관리.
//   CookieAuthGuard(쿠키 전용) — 토큰으로는 토큰을 관리할 수 없다(유출 토큰의 자기증식
//   차단). 항상 로그인한 사람 세션이어야 한다.
//   POST   /auth/tokens      발급 → { ..., token(평문 1회) }
//   GET    /auth/tokens      본인 목록(평문 없음)
//   DELETE /auth/tokens/:id  폐기(즉시 무효)
@Controller('auth/tokens')
@UseGuards(CookieAuthGuard)
export class ApiTokensController {
  constructor(private readonly apiTokens: ApiTokenService) {}

  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateApiTokenDto,
  ): Promise<IssuedApiToken> {
    const user = (req as Request & { user?: AuthUser }).user!;
    return this.apiTokens.createForUser(user.id, dto.name, dto.expiresInDays);
  }

  @Get()
  async list(@Req() req: Request): Promise<{ tokens: ApiTokenView[] }> {
    const user = (req as Request & { user?: AuthUser }).user!;
    const tokens = await this.apiTokens.listForUser(user.id);
    return { tokens };
  }

  @Delete(':id')
  async revoke(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    const user = (req as Request & { user?: AuthUser }).user!;
    return this.apiTokens.revokeForUser(user.id, id);
  }
}
