import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AttachmentsService, MAX_SIZE_BYTES } from './attachments.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  SpacePermissionService,
  type Actor,
} from '../spaces/space-permission.service';

// Cycle L5 (feature/ldh) — 권한 판정용 actor(role 포함).
function userFromReq(req: Request): Actor {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}

@Controller()
export class AttachmentsController {
  constructor(
    private readonly attachments: AttachmentsService,
    // Cycle L5 — 첨부는 소속 페이지의 스페이스 권한을 따른다.
    private readonly perms: SpacePermissionService,
  ) {}

  // FR-080 — 페이지에 파일 업로드. multer는 buffer 모드라 파일이 controller에
  // 도달했다는 건 곧 완전 수신을 뜻한다 (NFR-A-022 충족: 부분 파일 자체가 없음).
  // Cycle L5 — 인증 + 페이지 편집 권한 필수(무가드 업로드 구멍 폐쇄).
  @Post('pages/:pageId/attachments')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_SIZE_BYTES } }),
  )
  async uploadAttachment(
    @Param('pageId') pageId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
    @Req() req: Request,
  ) {
    await this.perms.assertCanEditPage(pageId, userFromReq(req));
    return this.attachments.createOnPage(pageId, file, dto.authorName);
  }

  // Cycle L5 — 목록도 페이지 읽기 권한 필수(비공개/제한 페이지 첨부 enumeration 차단).
  @Get('pages/:pageId/attachments')
  @UseGuards(OptionalJwtAuthGuard)
  async listByPage(@Param('pageId') pageId: string, @Req() req: Request) {
    await this.perms.assertCanViewPage(pageId, userFromReq(req));
    return this.attachments.listByPage(pageId);
  }

  // FR-082 — 다운로드. 한글 파일명은 RFC 5987 filename* (UTF-8) 로 인코딩.
  // Cycle L5 — 다운로드 전 소속 페이지 읽기 권한 확인(파일 내용 누수 차단).
  //   PUBLIC 페이지는 그대로 통과(OptionalJwt). 익명 공유는 별도 /share/:token 경로.
  @Get('attachments/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async download(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const att = await this.attachments.getById(id);
    await this.perms.assertCanViewPage(att.pageId, userFromReq(req));
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

  // Cycle L5 — 삭제도 인증 + 페이지 편집 권한 필수(무가드 삭제 구멍 폐쇄).
  @Delete('attachments/:id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const att = await this.attachments.getById(id);
    await this.perms.assertCanEditPage(att.pageId, userFromReq(req));
    return this.attachments.remove(id);
  }
}
