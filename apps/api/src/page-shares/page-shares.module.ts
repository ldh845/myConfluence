import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { PageSharesController } from './page-shares.controller';
import { PageSharesService } from './page-shares.service';

@Module({
  imports: [AttachmentsModule],
  controllers: [PageSharesController],
  providers: [PageSharesService],
})
export class PageSharesModule {}
