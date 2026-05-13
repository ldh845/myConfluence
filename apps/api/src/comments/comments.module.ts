import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { ActivitiesModule } from '../activities/activities.module';

@Module({
  // FR-131 (Cycle 24) — 댓글 생성 시 activity log.
  imports: [ActivitiesModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
