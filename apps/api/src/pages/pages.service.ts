import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { PublishPageDto } from './dto/publish-page.dto';
import { CreateDiagramDto } from './dto/create-diagram.dto';

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
    return this.prisma.page.findMany({ orderBy: { createdAt: 'asc' } });
  }

  // FR-034 (Cycle 11-1) — 내부 페이지 링크 modal용 제목 검색.
  // 인증 도입 후엔 권한 필터를 추가한다. ILIKE로 한국어 포함 대소문자 무관.
  search(query: string, limit = 10) {
    const trimmed = (query ?? '').trim();
    if (!trimmed) return [];
    return this.prisma.page.findMany({
      where: { title: { contains: trimmed, mode: 'insensitive' } },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, spaceId: true, updatedAt: true },
    });
  }

  // FR-090 / FR-092 (Cycle 15-1a) — 전문 검색.
  // 제목·본문 ILIKE (pg_trgm GIN 인덱스가 가속). app-level에서 제목 매칭을
  // 우선 정렬한 뒤, 본문 매칭 위치 주변 60자를 snippet으로 추출한다.
  async fullSearch(query: string, limit = 20, offset = 0) {
    const trimmed = (query ?? '').trim();
    if (!trimmed) return { results: [], total: 0 };
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);
    const where: Prisma.PageWhereInput = {
      OR: [
        { title: { contains: trimmed, mode: 'insensitive' } },
        { content: { contains: trimmed, mode: 'insensitive' } },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        take: safeLimit,
        skip: safeOffset,
        orderBy: { updatedAt: 'desc' },
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
    const lowerQ = trimmed.toLowerCase();
    rows.sort((a, b) => {
      const aTitle = a.title.toLowerCase().includes(lowerQ);
      const bTitle = b.title.toLowerCase().includes(lowerQ);
      if (aTitle !== bTitle) return aTitle ? -1 : 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
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
    const page = await this.prisma.page.findUnique({ where: { id } });
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
  update(id: string, dto: UpdatePageDto) {
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.page.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        },
      });
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

  async remove(id: string) {
    // FR-080 — 페이지 삭제 시 첨부 파일도 디스크에서 제거. DB row는 cascade
    // 가 처리하지만 디스크 파일은 별도로 best-effort로 정리한다. 자식 페이지의
    // 첨부도 같이 청소하기 위해 삭제 대상 트리 전체의 storageKey를 한 번에
    // 모은다.
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

  // 자손 페이지를 BFS로 모아 첨부 정리 시 모두 포함되게 한다.
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
