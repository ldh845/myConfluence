import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { SpacesService } from './spaces.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { SetHomePageDto } from './dto/set-home-page.dto';
import { UpdateSpaceSettingsDto } from './dto/update-space-settings.dto';

// Cycle 74-B — 권한 판정용 actor(role 포함).
function userFromReq(
  req: Request,
): { id: string; name: string; role: string } | null {
  return req.user
    ? { id: req.user.id, name: req.user.name, role: req.user.role }
    : null;
}

@Controller('spaces')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  // Cycle 32 — 인증 시 본인 개인 공간도 포함, 비인증이면 SITE만.
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@Req() req: Request) {
    return this.spaces.findAll(
      req.user ? { id: req.user.id, role: req.user.role } : null,
    );
  }

  // Cycle 32 — 개인 공간 lazy 생성/조회. /spaces/:id 보다 위에 선언.
  @Get('personal')
  @UseGuards(JwtAuthGuard)
  personal(@Req() req: Request) {
    return this.spaces.getOrCreatePersonal({
      id: req.user!.id,
      name: req.user!.name,
    });
  }

  // Cycle 33 — 공간 생성 시 홈 페이지 자동 생성. 인증 시 actor 전달.
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(@Body() dto: CreateSpaceDto, @Req() req: Request) {
    return this.spaces.create(
      dto,
      req.user ? { id: req.user.id, name: req.user.name } : null,
    );
  }

  // Cycle 33 — 공간 홈 페이지 지정.
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  setHomePage(@Param('id') id: string, @Body() dto: SetHomePageDto) {
    return this.spaces.setHomePage(id, dto.homePageId);
  }

  // Cycle 74-B — 공간 도구 '개요' 탭: 이름/설명/공개범위 변경. canManage 는 service 에서.
  @Patch(':id/settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateSpaceSettingsDto,
    @Req() req: Request,
  ) {
    return this.spaces.updateSettings(id, dto, userFromReq(req));
  }

  // Cycle 74-B — 스페이스 삭제. canManage 는 service 에서.
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.spaces.remove(id, userFromReq(req));
  }
}
