import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

// FR-070 (Cycle 16-1a) — 페이지 댓글 서비스.
// flat 배열로 응답하고 클라이언트가 parentId 기반으로 트리를 구성한다.
// 권한 체크는 인증 사이클까지 보류 — 누구나 작성/수정/삭제.

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(pageId: string, dto: CreateCommentDto) {
    const body = (dto?.body ?? '').trim();
    if (!body) throw new BadRequestException({ error: 'body required' });
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, pageId: true },
      });
      if (!parent || parent.pageId !== pageId) {
        throw new BadRequestException({ error: 'invalid parent' });
      }
    }
    return this.prisma.comment.create({
      data: {
        pageId,
        parentId: dto.parentId ?? null,
        authorName: dto.authorName ?? null,
        body,
      },
    });
  }

  listByPage(pageId: string) {
    return this.prisma.comment.findMany({
      where: { pageId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, dto: UpdateCommentDto) {
    const body = (dto?.body ?? '').trim();
    if (!body) throw new BadRequestException({ error: 'body required' });
    const existing = await this.prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException({ error: 'comment not found' });
    return this.prisma.comment.update({
      where: { id },
      data: {
        body,
        ...(dto.authorName !== undefined
          ? { authorName: dto.authorName ?? null }
          : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException({ error: 'comment not found' });
    // 자식 댓글은 schema의 onDelete: Cascade로 함께 정리됨.
    await this.prisma.comment.delete({ where: { id } });
    return { ok: true };
  }
}
