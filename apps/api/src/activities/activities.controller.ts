import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { ActivitiesService } from './activities.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  SpacePermissionService,
  type Actor,
} from '../spaces/space-permission.service';

// FR-131 (Cycle 24) — 활동 피드 조회. 필터: spaceId/type/actorName + pagination.
// Cycle 50 — ?types=a,b,c 다중 IN 필터 추가 (/home UpdatesView 가 사용자 활동
//   5종만 표시하는 데 사용). 기존 ?type= 단일 매칭은 호환 유지(/activity 사용).
// Cycle L5 (feature/ldh) — 공개 무가드였던 활동 피드에 가시성 필터 적용.
//   접근 가능한 스페이스(공개/멤버/개인 소유)의 활동 + 스페이스 없는 활동만 노출.
//   전역 ADMIN 은 전체. (공간 단위 감사 로그는 별도 /spaces/:id/audit — canManage.)
function userFromReq(req: Request): Actor {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}

@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly activities: ActivitiesService,
    private readonly perms: SpacePermissionService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Req() req: Request,
    @Query('spaceId') spaceId?: string,
    @Query('type') type?: string,
    @Query('types') types?: string,
    @Query('actorName') actorName?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // Cycle 50 — 콤마 split. 공백·빈 토큰 제거.
    const typesArr = types
      ? types
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : undefined;
    // Cycle L5 — 접근 가능한 스페이스의 활동 OR 스페이스 없는 활동만.
    const actor = userFromReq(req);
    const visibilityWhere: Prisma.ActivityLogWhereInput = {
      OR: [{ spaceId: null }, { space: this.perms.spaceVisibilityWhere(actor) }],
    };
    return this.activities.list({
      spaceId: spaceId || undefined,
      type: type || undefined,
      types: typesArr && typesArr.length > 0 ? typesArr : undefined,
      actorName: actorName || undefined,
      // Cycle 58 — 사용자 프로파일 페이지의 활동 피드용.
      actorId: actorId || undefined,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      visibilityWhere,
    });
  }
}
