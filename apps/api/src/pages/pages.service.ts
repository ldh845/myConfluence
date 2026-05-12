import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { PublishPageDto } from './dto/publish-page.dto';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { CopyPageDto } from './dto/copy-page.dto';

// FR-064 — 페이지당 보관할 PageVersion 수. 환경변수 미설정/잘못된 값일
// 때는 50으로 폴백해 무한 누적을 막고, 동시에 잘못된 0/음수가 들어와
// 모든 버전이 지워지는 사고도 막는다.
function resolveRetentionLimit(): number {
  const raw = Number(process.env.PAGE_VERSION_RETENTION ?? 50);
  if (!Number.isFinite(raw) || raw <= 0) return 50;
  return Math.floor(raw);
}

const EMPTY_EXCALIDRAW = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  source: 'myconfluence',
  elements: [],
  appState: { viewBackgroundColor: '#ffffff', gridSize: null },
  files: {},
});

@Injectable()
export class PagesService {
  // 모듈 로드 시 한 번만 평가. dev 시 .env 변경 후 재시작 필요.
  private readonly retentionLimit = resolveRetentionLimit();

  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
  ) {}

  // FR-064 — 같은 트랜잭션 안에서 호출. 새 PageVersion이 막 추가된
  // 직후라, 보관 한도를 넘겼다면 가장 오래된 것부터 잘라낸다.
  private async cleanupOldVersions(
    tx: Prisma.TransactionClient,
    pageId: string,
  ): Promise<void> {
    const limit = this.retentionLimit;
    const total = await tx.pageVersion.count({ where: { pageId } });
    if (total <= limit) return;
    const excess = total - limit;
    const toDelete = await tx.pageVersion.findMany({
      where: { pageId },
      orderBy: { version: 'asc' },
      take: excess,
      select: { id: true },
    });
    if (toDelete.length === 0) return;
    await tx.pageVersion.deleteMany({
      where: { id: { in: toDelete.map((v) => v.id) } },
    });
  }

  findAll() {
    return this.prisma.page.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  // FR-034 (Cycle 11-1) — 내부 페이지 링크 modal용 제목 검색.
  // 인증 도입 후엔 권한 필터를 추가한다. ILIKE로 한국어 포함 대소문자 무관.
  // FR-024 (18-1a) — 휴지통 페이지 제외.
  search(query: string, limit = 10) {
    const trimmed = (query ?? '').trim();
    if (!trimmed) return [];
    return this.prisma.page.findMany({
      where: {
        title: { contains: trimmed, mode: 'insensitive' },
        deletedAt: null,
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, spaceId: true, updatedAt: true },
    });
  }

  // FR-090 / FR-092 (Cycle 15-1a) — 전문 검색.
  // 제목·본문 ILIKE (pg_trgm GIN 인덱스가 가속). app-level에서 제목 매칭을
  // 우선 정렬한 뒤, 본문 매칭 위치 주변 60자를 snippet으로 추출한다.
  // FR-091 (Cycle 15-3) — 스페이스/날짜 필터 + 정렬 옵션 추가.
  async fullSearch(
    query: string,
    limit = 20,
    offset = 0,
    opts: {
      spaceId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      sort?: 'relevance' | 'newest' | 'updated';
    } = {},
  ) {
    const trimmed = (query ?? '').trim();
    if (!trimmed) return { results: [], total: 0 };
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);
    const sort = opts.sort ?? 'relevance';

    const filters: Prisma.PageWhereInput[] = [
      {
        OR: [
          { title: { contains: trimmed, mode: 'insensitive' } },
          { content: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      // FR-024 (18-1a) — 휴지통 제외.
      { deletedAt: null },
    ];
    if (opts.spaceId) filters.push({ spaceId: opts.spaceId });
    if (opts.dateFrom || opts.dateTo) {
      filters.push({
        updatedAt: {
          ...(opts.dateFrom ? { gte: opts.dateFrom } : {}),
          ...(opts.dateTo ? { lte: opts.dateTo } : {}),
        },
      });
    }
    const where: Prisma.PageWhereInput = { AND: filters };

    const orderBy: Prisma.PageOrderByWithRelationInput =
      sort === 'newest'
        ? { createdAt: 'desc' }
        : { updatedAt: 'desc' };

    const [rows, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        take: safeLimit,
        skip: safeOffset,
        orderBy,
        select: {
          id: true,
          title: true,
          spaceId: true,
          updatedAt: true,
          content: true,
        },
      }),
      this.prisma.page.count({ where }),
    ]);

    // 관련도 정렬일 때만 app-level 제목 우선. 'newest'/'updated'는 SQL 정렬을 신뢰.
    if (sort === 'relevance') {
      const lowerQ = trimmed.toLowerCase();
      rows.sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(lowerQ);
        const bTitle = b.title.toLowerCase().includes(lowerQ);
        if (aTitle !== bTitle) return aTitle ? -1 : 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
    }

    const results = rows.map((r) => ({
      id: r.id,
      title: r.title,
      spaceId: r.spaceId,
      updatedAt: r.updatedAt,
      snippet: this.extractSnippet(r.content, trimmed),
    }));
    return { results, total };
  }

  private extractSnippet(
    content: string,
    query: string,
    contextChars = 60,
  ): string {
    if (!content) return '';
    const lowerContent = content.toLowerCase();
    const idx = lowerContent.indexOf(query.toLowerCase());
    if (idx === -1) {
      const head = content.slice(0, contextChars * 2).trim();
      return content.length > contextChars * 2 ? `${head}...` : head;
    }
    const start = Math.max(0, idx - contextChars);
    const end = Math.min(content.length, idx + query.length + contextChars);
    const body = content.slice(start, end).trim();
    return (
      (start > 0 ? '...' : '') +
      body +
      (end < content.length ? '...' : '')
    );
  }

  async findOne(id: string) {
    const page = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
    });
    if (!page) throw new NotFoundException({ error: 'not found' });
    return page;
  }

  create(dto: CreatePageDto) {
    return this.prisma.page.create({
      data: {
        title: dto.title,
        content: dto.content ?? '',
        spaceId: dto.spaceId,
        parentId: dto.parentId ?? null,
      },
    });
  }

  // FR-060 / FR-061 — 페이지가 변경될 때마다 PageVersion 스냅샷을 생성한다.
  // page.update와 version.create는 같은 트랜잭션이라 둘 중 하나가 실패하면
  // 함께 롤백된다. authorName은 FR-002 인증이 들어오기 전까지 클라이언트의
  // 익명 이름을 그대로 보관한다.
  // FR-022 (Cycle 18-3a) — spaceId/parentId 변경(페이지 이동) 시 자손 spaceId
  // 동기화 + 순환 참조 가드.
  async update(id: string, dto: UpdatePageDto) {
    const current = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, spaceId: true, parentId: true },
    });
    if (!current) throw new NotFoundException({ error: 'page not found' });

    const targetSpaceId = dto.spaceId ?? current.spaceId;

    // spaceId 변경 시 target Space 존재 확인.
    if (dto.spaceId && dto.spaceId !== current.spaceId) {
      const space = await this.prisma.space.findUnique({
        where: { id: dto.spaceId },
        select: { id: true },
      });
      if (!space) {
        throw new NotFoundException({ error: 'target space not found' });
      }
    }

    // parentId 변경 시 순환 참조 + parent 스페이스 일치 가드.
    if (
      dto.parentId !== undefined &&
      dto.parentId !== null &&
      dto.parentId !== current.parentId
    ) {
      if (dto.parentId === id) {
        throw new BadRequestException({
          error: 'cannot be parent of itself',
        });
      }
      const parent = await this.prisma.page.findFirst({
        where: { id: dto.parentId, deletedAt: null },
        select: { id: true, spaceId: true },
      });
      if (!parent) {
        throw new NotFoundException({ error: 'parent page not found' });
      }
      if (parent.spaceId !== targetSpaceId) {
        throw new BadRequestException({
          error: 'parent must be in target space',
        });
      }
      const descendants = await this.collectDescendantIds(id);
      if (descendants.includes(dto.parentId)) {
        throw new BadRequestException({
          error: 'cannot move under own descendant',
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const page = await tx.page.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.spaceId !== undefined ? { spaceId: dto.spaceId } : {}),
        },
      });

      // FR-022 — 자손 spaceId 동기화. collectDescendantIds는 deletedAt 무관이라
      // 휴지통 자손도 함께 따라간다 (페이지 트리 통째 이동의 자연스러운 의미).
      if (dto.spaceId && dto.spaceId !== current.spaceId) {
        const descendants = await this.collectDescendantIds(id);
        const others = descendants.filter((d) => d !== id);
        if (others.length > 0) {
          await tx.page.updateMany({
            where: { id: { in: others } },
            data: { spaceId: dto.spaceId },
          });
        }
      }

      const last = await tx.pageVersion.findFirst({
        where: { pageId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      await tx.pageVersion.create({
        data: {
          pageId: id,
          title: page.title,
          content: page.content,
          authorName: dto.authorName ?? null,
          version: (last?.version ?? 0) + 1,
        },
      });
      await this.cleanupOldVersions(tx, id);
      return page;
    });
  }

  listVersions(pageId: string) {
    return this.prisma.pageVersion.findMany({
      where: { pageId },
      orderBy: { version: 'desc' },
    });
  }

  // 이슈 2 (Cycle 10-1) — 임시 저장.
  // PageVersion은 만들지 않는다 (drafts는 발행 시점에만 history에 적재).
  async updateDraft(id: string, dto: UpdateDraftDto) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    return this.prisma.page.update({
      where: { id },
      data: { draftContent: dto.content },
    });
  }

  // 이슈 2 (Cycle 10-1) — 발행.
  // draft → content 승격 + draft 비움 + PageVersion 스냅샷 + retention cap.
  // 모두 같은 트랜잭션이므로 한쪽 실패 시 함께 롤백.
  publish(id: string, dto: PublishPageDto) {
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.page.findUnique({ where: { id } });
      if (!page) throw new NotFoundException({ error: 'page not found' });
      if (page.draftContent === null) {
        throw new BadRequestException({ error: 'no draft to publish' });
      }
      const published = await tx.page.update({
        where: { id },
        data: { content: page.draftContent, draftContent: null },
      });
      const last = await tx.pageVersion.findFirst({
        where: { pageId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      await tx.pageVersion.create({
        data: {
          pageId: id,
          title: published.title,
          content: published.content,
          authorName: dto.authorName ?? null,
          version: (last?.version ?? 0) + 1,
        },
      });
      await this.cleanupOldVersions(tx, id);
      return published;
    });
  }

  // FR-063 — 특정 PageVersion으로 페이지를 되돌린다.
  // 동시에 새 PageVersion 한 행을 추가해 원복 자체를 히스토리로 남긴다.
  // 두 단계가 같은 트랜잭션이라 한쪽 실패 시 모두 롤백.
  restoreVersion(
    pageId: string,
    versionId: string,
    authorName?: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.pageVersion.findUnique({
        where: { id: versionId },
      });
      if (!target || target.pageId !== pageId) {
        throw new NotFoundException({ error: 'version not found' });
      }
      const page = await tx.page.update({
        where: { id: pageId },
        data: { title: target.title, content: target.content },
      });
      const last = await tx.pageVersion.findFirst({
        where: { pageId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      await tx.pageVersion.create({
        data: {
          pageId,
          title: page.title,
          content: page.content,
          authorName: authorName ?? null,
          version: (last?.version ?? 0) + 1,
        },
      });
      await this.cleanupOldVersions(tx, pageId);
      return page;
    });
  }

  // FR-024 (Cycle 18-1a) — 휴지통(soft delete). 자식까지 재귀 cascade.
  // 영구 삭제는 permanentDelete. 디스크 첨부 파일 정리는 permanentDelete 시점에만.
  async remove(id: string) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    if (page.deletedAt) {
      throw new BadRequestException({ error: 'already in trash' });
    }
    const targetIds = await this.collectDescendantIds(id);
    await this.prisma.page.updateMany({
      where: { id: { in: targetIds } },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  // FR-024 (Cycle 18-1a) — 휴지통 복구. 휴지통에 있는 자식까지 함께 복구.
  async restore(id: string) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    if (!page.deletedAt) {
      throw new BadRequestException({ error: 'not in trash' });
    }
    const targetIds = await this.collectDeletedDescendantIds(id);
    await this.prisma.page.updateMany({
      where: { id: { in: targetIds } },
      data: { deletedAt: null },
    });
    return { ok: true };
  }

  // FR-024 (Cycle 18-1a) — 영구 삭제. 휴지통에 있는 페이지만 가능.
  // Prisma cascade로 자식·다이어그램·첨부·댓글·버전 row 자동 정리.
  // 디스크 첨부 파일은 best-effort로 별도 청소.
  async permanentDelete(id: string) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    if (!page.deletedAt) {
      throw new BadRequestException({ error: 'must be in trash first' });
    }
    const targetIds = await this.collectDescendantIds(id);
    const orphans = await this.prisma.attachment.findMany({
      where: { pageId: { in: targetIds } },
      select: { storageKey: true },
    });
    await this.prisma.page.delete({ where: { id } });
    if (orphans.length > 0) {
      await this.attachments.cleanupFiles(orphans.map((o) => o.storageKey));
    }
    return { ok: true };
  }

  // FR-024 (Cycle 18-1a) — 휴지통 목록.
  listTrash() {
    return this.prisma.page.findMany({
      where: { NOT: { deletedAt: null } },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true,
        title: true,
        spaceId: true,
        parentId: true,
        deletedAt: true,
        updatedAt: true,
      },
    });
  }

  // FR-023 (Cycle 18-4a) — 페이지 깊은 복사.
  // 정책:
  //  - Page row: 새 cuid, draftContent=null (편집 중 내용은 복제 X)
  //  - Attachment row: 새 storageKey + 디스크 파일 복사
  //  - Diagram row: 그대로 복제
  //  - 복제 안 함: PageVersion, Comment, 즐겨찾기
  // 안정성:
  //  - 디스크 복사는 트랜잭션 직전에 수행 → 실패 시 throw, DB 영향 0
  //  - 트랜잭션 실패 시 이미 복사한 파일은 cleanup
  async copy(id: string, dto: CopyPageDto) {
    const source = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        content: true,
        spaceId: true,
        parentId: true,
      },
    });
    if (!source) throw new NotFoundException({ error: 'page not found' });

    const targetSpaceId = dto.targetSpaceId || source.spaceId;
    const targetParentId =
      dto.targetParentId === undefined
        ? source.parentId
        : (dto.targetParentId || null);

    if (dto.targetSpaceId && dto.targetSpaceId !== source.spaceId) {
      const space = await this.prisma.space.findUnique({
        where: { id: dto.targetSpaceId },
        select: { id: true },
      });
      if (!space) {
        throw new NotFoundException({ error: 'target space not found' });
      }
    }

    if (targetParentId) {
      const parent = await this.prisma.page.findFirst({
        where: { id: targetParentId, deletedAt: null },
        select: { id: true, spaceId: true },
      });
      if (!parent) {
        throw new NotFoundException({ error: 'parent page not found' });
      }
      if (parent.spaceId !== targetSpaceId) {
        throw new BadRequestException({
          error: 'parent must be in target space',
        });
      }
      if (dto.recursive) {
        const descendants = await this.collectDescendantIds(id);
        if (descendants.includes(targetParentId)) {
          throw new BadRequestException({
            error: 'cannot copy under own descendant',
          });
        }
      }
    }

    // 복제 대상 페이지 수집 (활성만; 휴지통 자손은 복제 제외).
    const sourceIds = dto.recursive
      ? await this.collectDescendantIds(id)
      : [id];
    const sourcePagesRaw = await this.prisma.page.findMany({
      where: { id: { in: sourceIds }, deletedAt: null },
      select: {
        id: true,
        title: true,
        content: true,
        parentId: true,
      },
    });
    const sourceById = new Map(sourcePagesRaw.map((p) => [p.id, p]));

    // BFS — root 먼저, 그 다음 자식들 (idMap 매핑이 부모 먼저 채워지도록).
    const orderedSourceIds: string[] = [];
    const queue: string[] = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (!sourceById.has(cur)) continue;
      orderedSourceIds.push(cur);
      const childIds = sourcePagesRaw
        .filter((p) => p.parentId === cur)
        .map((p) => p.id);
      queue.push(...childIds);
    }

    // 첨부 · 다이어그램 미리 조회 + 새 storageKey 결정.
    const sourceAttachments = await this.prisma.attachment.findMany({
      where: { pageId: { in: orderedSourceIds } },
    });
    const sourceDiagrams = await this.prisma.diagram.findMany({
      where: { pageId: { in: orderedSourceIds } },
    });
    const attachmentPlans = sourceAttachments.map((a) => ({
      source: a,
      newStorageKey: `${randomUUID()}${path.extname(a.storageKey)}`,
    }));

    // 디스크 파일 복사 (트랜잭션 직전). 실패 시 이미 복사한 파일도 정리.
    const copiedKeys: string[] = [];
    try {
      for (const ap of attachmentPlans) {
        const src = this.attachments.resolvePath(ap.source.storageKey);
        const dst = this.attachments.resolvePath(ap.newStorageKey);
        await fs.copyFile(src, dst);
        copiedKeys.push(ap.newStorageKey);
      }
    } catch (err) {
      await this.attachments.cleanupFiles(copiedKeys);
      throw err;
    }

    // DB 트랜잭션 — page → attachment → diagram. 실패 시 디스크 파일 cleanup.
    try {
      return await this.prisma.$transaction(async (tx) => {
        const idMap = new Map<string, string>();
        let rootCreated: { id: string } | null = null;

        for (const sid of orderedSourceIds) {
          const sp = sourceById.get(sid)!;
          const isRoot = sid === id;
          const newParentId = isRoot
            ? targetParentId
            : (idMap.get(sp.parentId!) ?? null);
          const newTitle = isRoot
            ? (dto.title?.trim() || `${sp.title} (복사본)`)
            : sp.title;
          const created = await tx.page.create({
            data: {
              title: newTitle,
              content: sp.content,
              spaceId: targetSpaceId,
              parentId: newParentId,
              draftContent: null,
            },
          });
          idMap.set(sid, created.id);
          if (isRoot) rootCreated = created;
        }

        for (const ap of attachmentPlans) {
          const newPageId = idMap.get(ap.source.pageId);
          if (!newPageId) continue;
          await tx.attachment.create({
            data: {
              pageId: newPageId,
              filename: ap.source.filename,
              mimetype: ap.source.mimetype,
              size: ap.source.size,
              storageKey: ap.newStorageKey,
              authorName: ap.source.authorName,
            },
          });
        }

        for (const d of sourceDiagrams) {
          const newPageId = idMap.get(d.pageId);
          if (!newPageId) continue;
          await tx.diagram.create({
            data: {
              pageId: newPageId,
              title: d.title,
              data: d.data,
              preview: d.preview,
            },
          });
        }

        // 루트 새 페이지 전체 fetch — 컨트롤러 응답으로 반환.
        return tx.page.findUnique({ where: { id: rootCreated!.id } });
      });
    } catch (err) {
      await this.attachments.cleanupFiles(copiedKeys);
      throw err;
    }
  }

  // BFS — deletedAt 무관(부모/자식 트리 전체). 자손 페이지를 모아 cascade soft/hard
  // delete 또는 첨부 정리에 활용한다.
  private async collectDescendantIds(rootId: string): Promise<string[]> {
    const all: string[] = [rootId];
    let frontier: string[] = [rootId];
    while (frontier.length > 0) {
      const children = await this.prisma.page.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((c) => c.id);
      all.push(...frontier);
    }
    return all;
  }

  // 휴지통에 있는 자손만 BFS. restore 시 함께 휴지통 간 자식만 부활시키려는 용도.
  private async collectDeletedDescendantIds(
    rootId: string,
  ): Promise<string[]> {
    const all: string[] = [rootId];
    let frontier: string[] = [rootId];
    while (frontier.length > 0) {
      const children = await this.prisma.page.findMany({
        where: { parentId: { in: frontier }, NOT: { deletedAt: null } },
        select: { id: true },
      });
      frontier = children.map((c) => c.id);
      all.push(...frontier);
    }
    return all;
  }

  listDiagrams(pageId: string) {
    return this.prisma.diagram.findMany({
      where: { pageId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createDiagram(pageId: string, dto: CreateDiagramDto) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    const title =
      typeof dto.title === 'string' && dto.title.trim()
        ? dto.title
        : '새 다이어그램';
    const data =
      typeof dto.data === 'string' && dto.data.length > 0
        ? dto.data
        : EMPTY_EXCALIDRAW;
    return this.prisma.diagram.create({
      data: { pageId, title, data },
    });
  }
}
