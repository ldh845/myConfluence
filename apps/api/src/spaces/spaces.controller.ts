import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import {
  AddShortcutDto,
  UpdateShortcutDto,
  ReorderShortcutsDto,
} from './dto/shortcut.dto';

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

  // ─── Cycle 74-C — 멤버 관리(권한 탭). 모두 canManage 는 service 에서. ───
  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  listMembers(@Param('id') id: string, @Req() req: Request) {
    return this.spaces.listMembers(id, userFromReq(req));
  }

  @Post(':id/members')
  @UseGuards(JwtAuthGuard)
  addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @Req() req: Request,
  ) {
    return this.spaces.addMember(id, dto.userId, dto.role, userFromReq(req));
  }

  @Patch(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: Request,
  ) {
    return this.spaces.updateMemberRole(id, userId, dto.role, userFromReq(req));
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.spaces.removeMember(id, userId, userFromReq(req));
  }

  // Cycle 74-D — 감사 로그(공간 단위 ActivityLog 필터 뷰). canManage 는 service.
  @Get(':id/audit')
  @UseGuards(JwtAuthGuard)
  audit(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('type') type?: string,
    @Query('actorId') actorId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;
    return this.spaces.getAuditLog(
      id,
      {
        type: type || undefined,
        actorId: actorId || undefined,
        dateFrom: from && !isNaN(from.getTime()) ? from : undefined,
        dateTo: to && !isNaN(to.getTime()) ? to : undefined,
        limit: limit ? Number(limit) : 20,
        offset: offset ? Number(offset) : 0,
      },
      userFromReq(req),
    );
  }

  // ─── Cycle 74-F — 사이드바 바로가기. 목록은 findAll(GET /spaces) include 로 제공. ───
  @Post(':id/shortcuts')
  @UseGuards(JwtAuthGuard)
  addShortcut(
    @Param('id') id: string,
    @Body() dto: AddShortcutDto,
    @Req() req: Request,
  ) {
    return this.spaces.addShortcut(id, dto, userFromReq(req));
  }

  @Patch(':id/shortcuts/reorder')
  @UseGuards(JwtAuthGuard)
  reorderShortcuts(
    @Param('id') id: string,
    @Body() dto: ReorderShortcutsDto,
    @Req() req: Request,
  ) {
    return this.spaces.reorderShortcuts(id, dto.ids, userFromReq(req));
  }

  @Patch(':id/shortcuts/:shortcutId')
  @UseGuards(JwtAuthGuard)
  updateShortcut(
    @Param('id') id: string,
    @Param('shortcutId') shortcutId: string,
    @Body() dto: UpdateShortcutDto,
    @Req() req: Request,
  ) {
    return this.spaces.updateShortcut(id, shortcutId, dto, userFromReq(req));
  }

  @Delete(':id/shortcuts/:shortcutId')
  @UseGuards(JwtAuthGuard)
  removeShortcut(
    @Param('id') id: string,
    @Param('shortcutId') shortcutId: string,
    @Req() req: Request,
  ) {
    return this.spaces.removeShortcut(id, shortcutId, userFromReq(req));
  }
}
