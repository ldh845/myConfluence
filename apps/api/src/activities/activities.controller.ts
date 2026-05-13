import { Controller, Get, Query } from '@nestjs/common';
import { ActivitiesService } from './activities.service';

// FR-131 (Cycle 24) — 활동 피드 조회. 필터: spaceId/type/actorName + pagination.
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  list(
    @Query('spaceId') spaceId?: string,
    @Query('type') type?: string,
    @Query('actorName') actorName?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.activities.list({
      spaceId: spaceId || undefined,
      type: type || undefined,
      actorName: actorName || undefined,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
  }
}
