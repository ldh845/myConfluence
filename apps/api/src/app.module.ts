import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { SpacesModule } from './spaces/spaces.module';
import { PagesModule } from './pages/pages.module';

@Module({
  imports: [PrismaModule, SpacesModule, PagesModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
