import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AttachmentsService, MAX_SIZE_BYTES } from './attachments.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  // FR-080 — 페이지에 파일 업로드. multer는 buffer 모드라 파일이 controller에
  // 도달했다는 건 곧 완전 수신을 뜻한다 (NFR-A-022 충족: 부분 파일 자체가 없음).
  @Post('pages/:pageId/attachments')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_SIZE_BYTES } }),
  )
  uploadAttachment(
    @Param('pageId') pageId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
  ) {
    return this.attachments.createOnPage(pageId, file, dto.authorName);
  }

  @Get('pages/:pageId/attachments')
  listByPage(@Param('pageId') pageId: string) {
    return this.attachments.listByPage(pageId);
  }

  // FR-082 — 다운로드. 한글 파일명은 RFC 5987 filename* (UTF-8) 로 인코딩.
  @Get('attachments/:id')
  async download(@Param('id') id: string, @Res() res: Response) {
    const att = await this.attachments.getById(id);
    res.setHeader('Content-Type', att.mimetype);
    res.setHeader('Content-Length', String(att.size));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
    );
    const stream = this.attachments.createReadStream(att.storageKey);
    stream.on('error', (err) => {
      // 디스크 파일 누락 등은 stream에서 잡힌다. 헤더가 이미 나간 뒤일 수
      // 있으므로 응답은 끊고 다음 미들웨어가 알아서 처리하게 둔다.
      if (!res.headersSent) res.status(500);
      res.end();
      void err;
    });
    stream.pipe(res);
  }

  @Delete('attachments/:id')
  remove(@Param('id') id: string) {
    return this.attachments.remove(id);
  }
}
