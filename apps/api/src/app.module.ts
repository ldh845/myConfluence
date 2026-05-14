import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { ReactionsModule } from './reactions/reactions.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // FR-001 (Cycle 27a) — .env 로드(JWT_SECRET 등).
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SpacesModule,
    PagesModule,
    DiagramsModule,
    CollaborationModule,
    AttachmentsModule,
    CommentsModule,
    PageSharesModule,
    ActivitiesModule,
    ReactionsModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
