import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

// FR-070 (Cycle 16-1a) — 페이지 댓글 서비스.
// flat 배열로 응답하고 클라이언트가 parentId 기반으로 트리를 구성한다.
// FR-001 (Cycle 27d) — authorId/authorName은 JWT user에서 서버가 결정.
// 본인만 수정/삭제 가드는 Cycle 27e에서 추가 — 현재는 인증된 누구나 수정/삭제 가능.

const AUTHOR_SELECT = {
  id: true,
  username: true,
  name: true,
  department: true,
  role: true,
} as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
    // Cycle 60 — 댓글 작성 시 페이지 작성자 / 부모 댓글 작성자에게 알림.
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    pageId: string,
    dto: CreateCommentDto,
    actor: { id: string; name: string } | null,
  ) {
    const body = (dto?.body ?? '').trim();
    if (!body) throw new BadRequestException({ error: 'body required' });
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true, title: true, spaceId: true, authorId: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    let parentAuthorId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, pageId: true, authorId: true },
      });
      if (!parent || parent.pageId !== pageId) {
        throw new BadRequestException({ error: 'invalid parent' });
      }
      parentAuthorId = parent.authorId;
    }
    const created = await this.prisma.comment.create({
      data: {
        pageId,
        parentId: dto.parentId ?? null,
        authorId: actor?.id ?? null,
        authorName: actor?.name ?? null,
        body,
        isInline: dto.isInline ?? false,
        anchorJson: dto.anchorJson ?? null,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });
    await this.activities.log({
      type: 'comment.created',
      spaceId: page.spaceId,
      pageId: page.id,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      payload: {
        commentId: created.id,
        pageTitle: page.title,
        preview: body.slice(0, 80),
        isInline: !!dto.isInline,
      },
    });
    // Cycle 60 — 알림 트리거 (best-effort, notifyOne 안에서 자기 자신 skip).
    //   답글이면 부모 댓글 작성자, 신규 댓글이면 페이지 작성자.
    if (actor?.id) {
      const payload = {
        pageTitle: page.title,
        actorName: actor.name,
        preview: body.slice(0, 80),
      };
      if (dto.parentId) {
        await this.notifications.notifyOne({
          recipientId: parentAuthorId,
          actorId: actor.id,
          pageId: page.id,
          type: 'comment.reply',
          payload,
        });
      } else {
        await this.notifications.notifyOne({
          recipientId: page.authorId,
          actorId: actor.id,
          pageId: page.id,
          type: 'comment.created',
          payload,
        });
      }
    }
    return created;
  }

  // FR-071 (Cycle 16-3a) — 인라인 댓글 해결/해결 취소.
  // FR-001 (Cycle 27d) — resolvedBy는 JWT user.name.
  async resolve(id: string, actor: { id: string; name: string } | null) {
    const existing = await this.prisma.comment.findUnique({
      where: { id },
      select: { id: true, isInline: true },
    });
    if (!existing) throw new NotFoundException({ error: 'comment not found' });
    if (!existing.isInline) {
      throw new BadRequestException({
        error: 'only inline comments can be resolved',
      });
    }
    return this.prisma.comment.update({
      where: { id },
      data: {
        resolvedAt: new Date(),
        resolvedBy: actor?.name ?? null,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async unresolve(id: string) {
    const existing = await this.prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException({ error: 'comment not found' });
    return this.prisma.comment.update({
      where: { id },
      data: { resolvedAt: null, resolvedBy: null },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  // Cycle L5-2 (feature/ldh) — 댓글 쓰기 권한 판정용 컨텍스트 해석.
  //   댓글 → 소속 페이지/스페이스/작성자. 컨트롤러가 이걸로 본인 여부·편집/관리 권한을 판정.
  async getContext(
    id: string,
  ): Promise<{ pageId: string; spaceId: string; authorId: string | null }> {
    const c = await this.prisma.comment.findUnique({
      where: { id },
      select: {
        pageId: true,
        authorId: true,
        page: { select: { spaceId: true } },
      },
    });
    if (!c) throw new NotFoundException({ error: 'comment not found' });
    return { pageId: c.pageId, spaceId: c.page.spaceId, authorId: c.authorId };
  }

  listByPage(pageId: string) {
    return this.prisma.comment.findMany({
      where: { pageId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: AUTHOR_SELECT } },
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
      data: { body },
      include: { author: { select: AUTHOR_SELECT } },
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
