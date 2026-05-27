import { Controller, Get, Query } from '@nestjs/common';
import { ActivitiesService } from './activities.service';

// FR-131 (Cycle 24) — 활동 피드 조회. 필터: spaceId/type/actorName + pagination.
// Cycle 50 — ?types=a,b,c 다중 IN 필터 추가 (/home UpdatesView 가 사용자 활동
//   5종만 표시하는 데 사용). 기존 ?type= 단일 매칭은 호환 유지(/activity 사용).
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  list(
    @Query('spaceId') spaceId?: string,
    @Query('type') type?: string,
    @Query('types') types?: string,
    @Query('actorName') actorName?: string,
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
    return this.activities.list({
      spaceId: spaceId || undefined,
      type: type || undefined,
      types: typesArr && typesArr.length > 0 ? typesArr : undefined,
      actorName: actorName || undefined,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
  }
}
