import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { SpacesModule } from './spaces/spaces.module';
import { PagesModule } from './pages/pages.module';
import { DiagramsModule } from './diagrams/diagrams.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { CommentsModule } from './comments/comments.module';
import { PageSharesModule } from './page-shares/page-shares.module';
import { ActivitiesModule } from './activities/activities.module';

@Module({
  imports: [
    PrismaModule,
    SpacesModule,
    PagesModule,
    DiagramsModule,
    CollaborationModule,
    AttachmentsModule,
    CommentsModule,
    PageSharesModule,
    ActivitiesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
