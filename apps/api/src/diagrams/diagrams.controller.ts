import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { DiagramsService } from './diagrams.service';
import { UpdateDiagramDto } from './dto/update-diagram.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  SpacePermissionService,
  type Actor,
} from '../spaces/space-permission.service';

// Cycle L5 (feature/ldh) — 권한 판정용 actor(role 포함).
function userFromReq(req: Request): Actor {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}

// Cycle L5 — 다이어그램은 소속 페이지의 스페이스 권한을 따른다.
//   기존엔 가드가 전혀 없어 누구나 읽기/수정/삭제 가능했던 구멍을 폐쇄.
//   읽기=assertCanViewPage(PUBLIC 통과), 수정/삭제=assertCanEditPage.
@Controller('diagrams')
export class DiagramsController {
  constructor(
    private readonly diagrams: DiagramsService,
    private readonly perms: SpacePermissionService,
  ) {}

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const diagram = await this.diagrams.findOne(id);
    await this.perms.assertCanViewPage(diagram.pageId, userFromReq(req));
    return diagram;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDiagramDto,
    @Req() req: Request,
  ) {
    const diagram = await this.diagrams.findOne(id);
    await this.perms.assertCanEditPage(diagram.pageId, userFromReq(req));
    return this.diagrams.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const diagram = await this.diagrams.findOne(id);
    await this.perms.assertCanEditPage(diagram.pageId, userFromReq(req));
    return this.diagrams.remove(id);
  }
}
