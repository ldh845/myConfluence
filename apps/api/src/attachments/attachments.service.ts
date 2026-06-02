import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

// FR-080~083 — 첨부파일 백엔드. 파일은 로컬 디스크에, 메타는 Postgres에.
// path traversal은 storageKey가 UUID라 차단되고, 다운로드 시 originalname을
// Content-Disposition에 RFC 5987 인코딩으로 노출한다 (한국어 대응).

export const MAX_SIZE_BYTES =
  (Number(process.env.ATTACHMENT_MAX_SIZE_MB) || 100) * 1024 * 1024;

@Injectable()
export class AttachmentsService implements OnModuleInit {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly storageRoot = path.resolve(
    process.cwd(),
    process.env.ATTACHMENT_STORAGE_PATH ?? './storage/attachments',
  );

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await fs.mkdir(this.storageRoot, { recursive: true });
    this.logger.log(`Attachment storage at ${this.storageRoot}`);
  }

  resolvePath(storageKey: string): string {
    return path.join(this.storageRoot, storageKey);
  }

  createReadStream(storageKey: string) {
    return createReadStream(this.resolvePath(storageKey));
  }

  async createOnPage(
    pageId: string,
    file: Express.Multer.File,
    authorName?: string | null,
  ) {
    // 페이지 존재 확인. 없으면 디스크 쓰기 자체를 시도하지 않는다.
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });

    // multer/busboy는 multipart filename을 latin1로 디코드한다. 한국어
    // 등 멀티바이트 파일명은 UTF-8 바이트열을 latin1 문자로 본 결과가
    // originalname에 들어가 있어, latin1로 다시 직렬화해 UTF-8로 디코드
    // 해야 원래 글자가 복원된다.
    const originalName = Buffer.from(file.originalname, 'latin1').toString(
      'utf8',
    );

    const ext = path.extname(originalName);
    const storageKey = `${randomUUID()}${ext}`;
    const targetPath = this.resolvePath(storageKey);

    // 디스크 먼저 쓰고 DB. 디스크 성공 후 DB 실패하면 파일을 정리한다.
    await fs.writeFile(targetPath, file.buffer);
    try {
      return await this.prisma.attachment.create({
        data: {
          pageId,
          filename: originalName,
          mimetype: file.mimetype,
          size: file.size,
          storageKey,
          authorName: authorName ?? null,
        },
      });
    } catch (err) {
      await fs.unlink(targetPath).catch(() => undefined);
      throw err;
    }
  }

  listByPage(pageId: string) {
    return this.prisma.attachment.findMany({
      where: { pageId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundException({ error: 'attachment not found' });
    return att;
  }

  async remove(id: string) {
    const att = await this.getById(id);
    await this.prisma.attachment.delete({ where: { id } });
    await fs.unlink(this.resolvePath(att.storageKey)).catch(() => undefined);
    return { ok: true };
  }

  // 페이지 삭제 후 호출. DB row는 cascade로 사라진 뒤이므로 디스크만 정리.
  async cleanupFiles(storageKeys: string[]) {
    await Promise.all(
      storageKeys.map((k) =>
        fs.unlink(this.resolvePath(k)).catch(() => undefined),
      ),
    );
  }
}
