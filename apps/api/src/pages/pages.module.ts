import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  // FR-080 — PagesService.remove가 첨부 디스크 정리 시 AttachmentsService를
  // 호출하므로 AttachmentsModule을 import 한다.
  imports: [AttachmentsModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
