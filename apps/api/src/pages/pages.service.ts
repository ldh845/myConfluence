import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type Prisma,
  type PageStatus,
  type PageRestrictionMode,
  type PageRestrictionRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SpacePermissionService,
  type Actor,
} from '../spaces/space-permission.service';
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

// Cycle 78 — 레이블 정규화: trim → 빈값 제거 → 라벨당 50자 → 중복(대소문자 무시) 제거
//   → 최대 20개. 클라이언트 입력을 신뢰하지 않고 서버에서 항상 정리.
const MAX_LABELS = 20;
const MAX_LABEL_LEN = 50;
function normalizeLabels(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const label = (item ?? '').trim().slice(0, MAX_LABEL_LEN);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= MAX_LABELS) break;
  }
  return out;
}

@Injectable()
export class PagesService {
  // 모듈 로드 시 한 번만 평가. dev 시 .env 변경 후 재시작 필요.
  private readonly retentionLimit = resolveRetentionLimit();

  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
    private readonly activities: ActivitiesService,
    // Cycle 59 — 발행 시 멘션 추출 후 알림 트리거.
    private readonly notifications: NotificationsService,
    // Cycle 74-A — 스페이스 권한(가시성) 판정.
    private readonly perms: SpacePermissionService,
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

  findAll(actor: Actor = null) {
    return this.prisma.page.findMany({
      // Cycle 35-followup — 미발행 draft(publishedAt=null)는 어디에서도 노출 X.
      // 휴지통 + draft 모두 제외.
      // Cycle 74-A — 가시성 필터(비멤버는 PRIVATE/타인 PERSONAL 제외).
      where: {
        deletedAt: null,
        NOT: { publishedAt: null },
        ...this.perms.pageVisibilityWhere(actor),
      },
      // FR-021 (19a) — 사이드바 트리 정렬: position 우선, 동률은 createdAt.
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // FR-034 (Cycle 11-1) — 내부 페이지 링크 modal용 제목 검색.
  // 인증 도입 후엔 권한 필터를 추가한다. ILIKE로 한국어 포함 대소문자 무관.
  // FR-024 (18-1a) — 휴지통 페이지 제외.
  // Cycle 35-followup — 미발행 draft도 제외 (작성자 본인 외엔 존재 자체가 비공개).
  search(query: string, limit = 10, actor: Actor = null) {
    const trimmed = (query ?? '').trim();
    if (!trimmed) return [];
    return this.prisma.page.findMany({
      where: {
        title: { contains: trimmed, mode: 'insensitive' },
        deletedAt: null,
        NOT: { publishedAt: null },
        // Cycle 74-A — 가시성 필터.
        ...this.perms.pageVisibilityWhere(actor),
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, spaceId: true, updatedAt: true },
    });
  }

  // FR-130 (Cycle 22) — 홈 화면 "최근 수정된 페이지" 카드용.
  // 인증 도입 전이라 "내가 편집한 페이지"가 아닌 "전체 최근 수정 페이지"로 대체.
  // Cycle 35-followup — draft는 "최근 작업"에도 등장하지 않는다.
  // Cycle 51 — 스페이스 단위 필터(spaceId) + offset 페이지네이션 옵션 추가.
  //   /?spaceId=X&view=pages 의 SpacePagesView 가 사용. 둘 다 미지정 시 기존
  //   동작(/home 의 limit-only 호출) 과 완전 동일.
  // Cycle 71 — 상태 필터 where 절. 'NONE'=상태 없음(null). enum 값 + NONE 혼합 시 OR.
  //   빈 배열/undefined → 필터 없음(undefined 반환).
  private statusWhere(
    statuses?: Array<PageStatus | 'NONE'>,
  ): Prisma.PageWhereInput | undefined {
    if (!statuses || statuses.length === 0) return undefined;
    const enums = statuses.filter((s): s is PageStatus => s !== 'NONE');
    const ors: Prisma.PageWhereInput[] = [];
    if (enums.length) ors.push({ status: { in: enums } });
    if (statuses.includes('NONE')) ors.push({ status: null });
    return ors.length === 1 ? ors[0] : { OR: ors };
  }

  // Cycle 71 — statuses 필터(상태별 목록 보기) 추가. SpacePagesView 의 ?status= 가 사용.
  recent(
    opts: {
      limit?: number;
      spaceId?: string;
      offset?: number;
      statuses?: Array<PageStatus | 'NONE'>;
      // Cycle 74-A — 가시성 필터용 actor. 비멤버는 PRIVATE/타인 PERSONAL 페이지 제외.
      actor?: Actor;
    } = {},
  ) {
    const safeLimit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
    const safeOffset = Math.max(opts.offset ?? 0, 0);
    const where: Prisma.PageWhereInput = {
      deletedAt: null,
      NOT: { publishedAt: null },
      ...(opts.spaceId ? { spaceId: opts.spaceId } : {}),
      ...(this.statusWhere(opts.statuses) ?? {}),
      ...this.perms.pageVisibilityWhere(opts.actor ?? null),
    };
    return this.prisma.page.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: safeLimit,
      skip: safeOffset,
      select: {
        id: true,
        title: true,
        spaceId: true,
        updatedAt: true,
        // Cycle 70 — 카드 배지용 작업 상태.
        status: true,
        space: { select: { name: true } },
        author: { select: { id: true, name: true } },
        lastEditor: { select: { id: true, name: true } },
      },
    });
  }

  // Cycle 71 — 칸반 보드용. 공간의 발행·비삭제 페이지 전체(상태별 컬럼 그룹핑은 FE).
  //   페이지가 많은 공간 대비 상한 500. draft/휴지통은 제외(기존 정책).
  async boardPages(spaceId: string, userIds?: string[]) {
    if (!spaceId) return [];
    const where: Prisma.PageWhereInput = {
      spaceId,
      deletedAt: null,
      NOT: { publishedAt: null },
      // Cycle 73 — 사용자 필터(보드 상단 칩). 선택 사용자가 작성자(authorId)
      //   또는 마지막 편집자(lastEditorId)인 페이지만. 다중 선택은 OR.
      ...(userIds && userIds.length
        ? {
            OR: [
              { authorId: { in: userIds } },
              { lastEditorId: { in: userIds } },
            ],
          }
        : {}),
    };
    return this.prisma.page.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 500,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        author: { select: { id: true, name: true } },
      },
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
      // Cycle 31 — 다중 스페이스/작성자 필터.
      spaceIds?: string[];
      authorIds?: string[];
      dateFrom?: Date;
      dateTo?: Date;
      sort?: 'relevance' | 'newest' | 'updated';
    } = {},
    actor: Actor = null,
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
      // Cycle 35-followup — 미발행 draft 제외.
      { NOT: { publishedAt: null } },
    ];
    // Cycle 31 — 다중 스페이스 / 작성자 필터 (IN).
    if (opts.spaceIds?.length) {
      filters.push({ spaceId: { in: opts.spaceIds } });
    }
    if (opts.authorIds?.length) {
      filters.push({ authorId: { in: opts.authorIds } });
    }
    if (opts.dateFrom || opts.dateTo) {
      filters.push({
        updatedAt: {
          ...(opts.dateFrom ? { gte: opts.dateFrom } : {}),
          ...(opts.dateTo ? { lte: opts.dateTo } : {}),
        },
      });
    }
    // Cycle 74-A — 가시성 필터(비멤버는 PRIVATE/타인 PERSONAL 검색 결과 제외).
    const visWhere = this.perms.pageVisibilityWhere(actor);
    if (Object.keys(visWhere).length) filters.push(visWhere);
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
          // Cycle 31 — breadcrumb 경로 계산용 parentId.
          parentId: true,
          updatedAt: true,
          content: true,
          // Cycle 31 — 결과 카드 작성자 표시 + Contributor 필터 검증용.
          author: {
            select: { id: true, name: true, department: true },
          },
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
      parentId: r.parentId,
      updatedAt: r.updatedAt,
      author: r.author,
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

  async findOne(id: string, actor: Actor = null) {
    const page = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            department: true,
            role: true,
          },
        },
        lastEditor: {
          select: {
            id: true,
            username: true,
            name: true,
            department: true,
            role: true,
          },
        },
      },
    });
    if (!page) throw new NotFoundException({ error: 'not found' });
    // Cycle 74-A — 가시성 가드. PUBLIC=누구나, PRIVATE=멤버, PERSONAL=소유자.
    //   (전역 ADMIN override.) 비인가 read 는 403.
    const access = await this.perms.loadAccess(
      page.spaceId,
      actor?.id ?? null,
    );
    if (access && !this.perms.canView(access, actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    // Cycle 83 — VIEW_EDIT 모드면 페이지 제한 멤버 또는 작성자/관리자/전역 ADMIN 만.
    if (access) {
      await this.perms.assertCanViewPageRestriction(
        {
          id: page.id,
          spaceId: page.spaceId,
          authorId: page.authorId,
          restrictionMode: page.restrictionMode,
        },
        actor,
        access,
      );
    }
    return page;
  }

  // Cycle 70 — 페이지 작업 상태(To Do / In Progress / Done) 변경. status=null 이면 제거.
  //   ⚠️ 임시 가드: 페이지 작성자(authorId) 또는 ADMIN 만 변경 가능. 향후 권한
  //   시스템 사이클에서 페이지 단위 권한/자물쇠 정책으로 교체 예정.
  async changeStatus(
    id: string,
    status: PageStatus | null,
    user: { id: string; name: string; role: string } | null,
  ) {
    if (!user) throw new ForbiddenException({ error: 'unauthorized' });
    const page = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, spaceId: true, authorId: true, status: true },
    });
    if (!page) throw new NotFoundException({ error: 'not found' });

    const isAdmin = user.role === 'ADMIN';
    const isAuthor = page.authorId != null && page.authorId === user.id;
    if (!isAdmin && !isAuthor) {
      throw new ForbiddenException({
        error: 'forbidden: not page author or admin',
      });
    }

    const from = page.status ?? null;
    if (from !== status) {
      await this.prisma.page.update({
        where: { id },
        data: { status, statusAt: new Date(), statusById: user.id },
      });
      await this.activities.log({
        type: 'page.status_changed',
        spaceId: page.spaceId,
        pageId: page.id,
        actorId: user.id,
        actorName: user.name,
        payload: { from, to: status },
      });
    }
    // Cycle 74-A — 방금 편집한 사용자의 actor 로 반환(가시성 가드 통과).
    return this.findOne(id, user ? { id: user.id, role: user.role } : null);
  }

  // FR-001 (Cycle 27c) — author/lastEditor 자동 세팅.
  // Cycle 35 — dto.draft=true면 publishedAt=null (미발행 draft, 트리 미노출).
  // 그 외(기본)는 publishedAt=now() — 즉시 발행 상태로 트리에 노출.
  async create(
    dto: CreatePageDto,
    actor?: { id: string; name: string } | null,
  ) {
    const page = await this.prisma.page.create({
      data: {
        title: dto.title,
        content: dto.content ?? '',
        spaceId: dto.spaceId,
        parentId: dto.parentId ?? null,
        authorId: actor?.id ?? null,
        lastEditorId: actor?.id ?? null,
        publishedAt: dto.draft ? null : new Date(),
      },
    });
    await this.activities.log({
      type: 'page.created',
      spaceId: page.spaceId,
      pageId: page.id,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      payload: { title: page.title },
    });
    return page;
  }

  // FR-060 / FR-061 — 페이지가 변경될 때마다 PageVersion 스냅샷을 생성한다.
  // page.update와 version.create는 같은 트랜잭션이라 둘 중 하나가 실패하면
  // 함께 롤백된다. authorName은 FR-002 인증이 들어오기 전까지 클라이언트의
  // 익명 이름을 그대로 보관한다.
  // FR-022 (Cycle 18-3a) — spaceId/parentId 변경(페이지 이동) 시 자손 spaceId
  // 동기화 + 순환 참조 가드.
  // FR-001 (Cycle 27c) — 제목/본문 변경 시 lastEditorId 갱신.
  async update(
    id: string,
    dto: UpdatePageDto,
    actor?: { id: string; name: string } | null,
  ) {
    const userId = actor?.id ?? null;
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

    const moved =
      (dto.spaceId !== undefined && dto.spaceId !== current.spaceId) ||
      (dto.parentId !== undefined && dto.parentId !== current.parentId);

    // FR-001 — 본문/제목이 실제로 변경됐을 때만 lastEditor 갱신.
    const editorChange =
      (dto.title !== undefined || dto.content !== undefined) && userId
        ? { lastEditorId: userId }
        : {};

    const result = await this.prisma.$transaction(async (tx) => {
      const page = await tx.page.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.spaceId !== undefined ? { spaceId: dto.spaceId } : {}),
          // Cycle 78 — 레이블: trim/빈값 제거/중복 제거/길이·개수 상한 정규화.
          ...(dto.labels !== undefined
            ? { labels: normalizeLabels(dto.labels) }
            : {}),
          ...editorChange,
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

      // FR-021 (Cycle 19a) — 형제 reorder.
      // 다음 두 경우에만 발화:
      //  1) dto.position 명시
      //  2) parentId가 실제로 바뀜 (이 경우 새 그룹 마지막으로 추가)
      // 그 외엔 position 손대지 않음 (단순 title/content/spaceId 변경 회귀 보존).
      const finalParentId =
        dto.parentId !== undefined ? dto.parentId : current.parentId;
      const finalSpaceId = dto.spaceId ?? current.spaceId;
      const parentChanged =
        dto.parentId !== undefined && dto.parentId !== current.parentId;
      const positionExplicit = dto.position !== undefined;

      if (positionExplicit || parentChanged) {
        const siblings = await tx.page.findMany({
          where: {
            id: { not: id },
            parentId: finalParentId,
            spaceId: finalSpaceId,
            deletedAt: null,
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: { id: true },
        });
        const desired = positionExplicit
          ? Math.max(0, Math.min(siblings.length, dto.position!))
          : siblings.length; // 부모 변경 + position 미지정 → 마지막
        const sequence = [
          ...siblings.slice(0, desired).map((s) => s.id),
          id,
          ...siblings.slice(desired).map((s) => s.id),
        ];
        for (let i = 0; i < sequence.length; i++) {
          await tx.page.update({
            where: { id: sequence[i] },
            data: { position: i },
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

    // FR-131 — 페이지 이동(스페이스/부모 변경) 시 활동 로그.
    if (moved) {
      await this.activities.log({
        type: 'page.moved',
        spaceId: result.spaceId,
        pageId: result.id,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? dto.authorName ?? null,
        payload: {
          title: result.title,
          fromSpaceId: current.spaceId,
          fromParentId: current.parentId,
          toSpaceId: result.spaceId,
          toParentId: result.parentId,
        },
      });
    }
    return result;
  }

  listVersions(pageId: string) {
    return this.prisma.pageVersion.findMany({
      where: { pageId },
      orderBy: { version: 'desc' },
    });
  }

  // 이슈 2 (Cycle 10-1) — 임시 저장.
  // PageVersion은 만들지 않는다 (drafts는 발행 시점에만 history에 적재).
  async updateDraft(
    id: string,
    dto: UpdateDraftDto,
    actor?: { id: string; name: string } | null,
  ) {
    const userId = actor?.id ?? null;
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    return this.prisma.page.update({
      where: { id },
      data: {
        draftContent: dto.content,
        ...(userId ? { lastEditorId: userId } : {}),
      },
    });
  }

  // 이슈 2 (Cycle 10-1) — 발행.
  // draft → content 승격 + draft 비움 + PageVersion 스냅샷 + retention cap.
  // 모두 같은 트랜잭션이므로 한쪽 실패 시 함께 롤백.
  // Cycle 36 — dto.content가 오면 그 값을 권위로 사용한다. 자동저장(5초
  // debounce) 타이밍에 의존하지 않아 "두 번 발행해야 보이는" 버그를 차단.
  // dto.content 미지정 시엔 기존처럼 draftContent를 승격(하위호환).
  async publish(
    id: string,
    dto: PublishPageDto,
    actor?: { id: string; name: string } | null,
  ) {
    const userId = actor?.id ?? null;
    // 클라이언트가 명시적으로 content를 보냈는지 (빈 문자열 "" 도 명시로 인정).
    const explicitContent = dto.content !== undefined;
    // Cycle 74-D followup — 첫 발행(발행) vs 재발행(수정) 구분용. 업데이트 전 상태.
    let wasPublished = false;
    const published = await this.prisma.$transaction(async (tx) => {
      const page = await tx.page.findUnique({ where: { id } });
      if (!page) throw new NotFoundException({ error: 'page not found' });
      wasPublished = !!page.publishedAt;
      // 발행할 본문 결정. explicit이면 그 값, 아니면 서버 draftContent.
      // 둘 다 없으면 발행할 변경 없음(400). 빈 문자열 explicit은 허용.
      const nextContent = explicitContent
        ? (dto.content as string)
        : page.draftContent;
      if (nextContent === null) {
        throw new BadRequestException({ error: 'no draft to publish' });
      }
      const published = await tx.page.update({
        where: { id },
        data: {
          content: nextContent,
          draftContent: null,
          // Cycle 35 — 첫 발행이면 publishedAt 채움. 이미 발행된 페이지의
          // 재발행은 publishedAt을 그대로 둔다 (최초 공개 시각 보존).
          ...(page.publishedAt ? {} : { publishedAt: new Date() }),
          ...(userId ? { lastEditorId: userId } : {}),
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
          title: published.title,
          content: published.content,
          authorName: dto.authorName ?? null,
          // Cycle 34 — 발행 코멘트. 빈 문자열은 의미 없는 노이즈라 null로 정규화.
          note: dto.note?.trim() ? dto.note.trim() : null,
          version: (last?.version ?? 0) + 1,
        },
      });
      await this.cleanupOldVersions(tx, id);
      return published;
    });
    await this.activities.log({
      // Cycle 74-D followup — 이미 발행됐던 페이지의 재발행은 '수정'으로 구분.
      type: wasPublished ? 'page.updated' : 'page.published',
      spaceId: published.spaceId,
      pageId: published.id,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? dto.authorName ?? null,
      payload: { title: published.title },
    });
    // Cycle 59 — 발행 직후 멘션 추출 → 알림 트리거. best-effort: 실패해도 발행
    //   본체에 영향 X. content 가 markdown(옛 데이터)이면 mention 노드 없음 →
    //   자연 skip. notifyMentions 가 자기 자신 + 중복 dedupe 처리.
    if (actor?.id) {
      try {
        const mentionedIds = extractMentionIds(published.content);
        if (mentionedIds.length > 0) {
          await this.notifications.notifyMentions({
            actorId: actor.id,
            pageId: published.id,
            recipientUserIds: mentionedIds,
            payload: {
              pageTitle: published.title,
              actorName: actor.name,
            },
          });
        }
        // Cycle 61 — 지켜보는 사용자에게 발행 알림 (매 발행마다 refresh).
        await this.notifications.notifyWatchers({
          actorId: actor.id,
          pageId: published.id,
          payload: {
            pageTitle: published.title,
            actorName: actor.name,
          },
        });
      } catch {
        // ignore — best-effort
      }
    }
    return published;
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

  // FR-024 (Cycle 18-1a) — 휴지통(soft delete). 영구 삭제는 permanentDelete.
  // 디스크 첨부 파일 정리는 permanentDelete 시점에만.
  // Cycle 56 — opts.cascade 추가:
  //   - cascade=true  → 기존 동작 (자손 모두 휴지통)
  //   - cascade=false → 직접 자식의 parentId 를 부모의 parentId 로 승격 + 부모만 휴지통
  //   - 자식 없으면 cascade 옵션 무관 (단일 삭제)
  //   기본값 false — 사용자 의도("딱 페이지만") 에 맞춤. cascade 는 옵션 선택.
  async remove(
    id: string,
    opts: { cascade?: boolean } = {},
    actor?: { id: string; name: string } | null,
  ) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        spaceId: true,
        parentId: true,
        deletedAt: true,
      },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    if (page.deletedAt) {
      throw new BadRequestException({ error: 'already in trash' });
    }

    // 직접 자식(활성)만 카운트 — 승격 대상.
    const childCount = await this.prisma.page.count({
      where: { parentId: id, deletedAt: null },
    });

    let promotedChildren = 0;
    let descendantsTrashed = 0;

    if (opts.cascade || childCount === 0) {
      // cascade 또는 자식 없음 → 기존 동작 (자손 모두 휴지통).
      const targetIds = await this.collectDescendantIds(id);
      await this.prisma.page.updateMany({
        where: { id: { in: targetIds } },
        data: { deletedAt: new Date() },
      });
      descendantsTrashed = targetIds.length - 1;
    } else {
      // 단일 삭제 + 직접 자식 승격. 트랜잭션으로 일관성 보장.
      //   page.parentId 가 null 이면 자식들도 root 가 됨 (parentId=null).
      //   position 은 그대로 유지 — 같은 그룹 내 중복 가능하지만 정렬 안정.
      await this.prisma.$transaction([
        this.prisma.page.updateMany({
          where: { parentId: id, deletedAt: null },
          data: { parentId: page.parentId },
        }),
        this.prisma.page.update({
          where: { id },
          data: { deletedAt: new Date() },
        }),
      ]);
      promotedChildren = childCount;
    }

    await this.activities.log({
      type: 'page.soft_deleted',
      spaceId: page.spaceId,
      pageId: page.id,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      payload: {
        title: page.title,
        ...(descendantsTrashed > 0 ? { descendants: descendantsTrashed } : {}),
        ...(promotedChildren > 0 ? { promotedChildren } : {}),
      },
    });
    return { ok: true, promotedChildren, descendantsTrashed };
  }

  // FR-024 (Cycle 18-1a) — 휴지통 복구. 휴지통에 있는 자식까지 함께 복구.
  async restore(id: string, actor?: { id: string; name: string } | null) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true, title: true, spaceId: true, deletedAt: true },
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
    await this.activities.log({
      type: 'page.restored',
      spaceId: page.spaceId,
      pageId: page.id,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      payload: { title: page.title, descendants: targetIds.length - 1 },
    });
    return { ok: true };
  }

  // FR-024 (Cycle 18-1a) — 영구 삭제. 휴지통에 있는 페이지만 가능.
  // Prisma cascade로 자식·다이어그램·첨부·댓글·버전 row 자동 정리.
  // 디스크 첨부 파일은 best-effort로 별도 청소.
  async permanentDelete(id: string, actor?: { id: string; name: string } | null) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        spaceId: true,
        deletedAt: true,
        space: { select: { name: true } },
      },
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
    // FR-131 — 영구 삭제. pageId는 곧 NULL이 되니 payload에 스냅샷.
    await this.activities.log({
      type: 'page.permanent_deleted',
      spaceId: null,
      pageId: null,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      payload: {
        deletedTitle: page.title,
        deletedSpaceName: page.space?.name ?? null,
        descendants: targetIds.length - 1,
      },
    });
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
  async copy(
    id: string,
    dto: CopyPageDto,
    actor?: { id: string; name: string } | null,
  ) {
    const userId = actor?.id ?? null;
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
    let resultPage;
    try {
      resultPage = await this.prisma.$transaction(async (tx) => {
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
              authorId: userId ?? null,
              lastEditorId: userId ?? null,
              // Cycle 35 — 복사는 즉시 발행 상태(트리에 바로 노출).
              publishedAt: new Date(),
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

    if (resultPage) {
      await this.activities.log({
        type: 'page.copied',
        spaceId: resultPage.spaceId,
        pageId: resultPage.id,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        payload: {
          title: resultPage.title,
          sourcePageId: source.id,
          recursive: !!dto.recursive,
        },
      });
    }
    return resultPage;
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

  // ─── Cycle 83 — 페이지 단위 제한 API ──────────────────────────────────────

  async getRestriction(pageId: string, actor: Actor) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: {
        id: true,
        spaceId: true,
        authorId: true,
        restrictionMode: true,
      },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    const access = await this.perms.loadAccess(page.spaceId, actor?.id ?? null);
    if (!access) throw new NotFoundException({ error: 'space not found' });
    if (!this.perms.canView(access, actor)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    await this.perms.assertCanViewPageRestriction(page, actor, access);
    const members = await this.prisma.pageRestriction.findMany({
      where: { pageId },
      include: {
        user: { select: { id: true, name: true, department: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const canManage = await this.perms.canManagePageRestriction(pageId, actor);
    return {
      mode: page.restrictionMode,
      canManage,
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        name: m.user.name,
        department: m.user.department ?? null,
      })),
    };
  }

  async updateRestrictionMode(
    pageId: string,
    mode: PageRestrictionMode,
    actor: Actor,
    members?: Array<{ userId: string; role: PageRestrictionRole }>,
  ) {
    await this.perms.assertCanManagePageRestriction(pageId, actor);
    const current = await this.prisma.page.findUnique({
      where: { id: pageId },
      select: { restrictionMode: true },
    });
    if (!current) throw new NotFoundException({ error: 'page not found' });

    if (members === undefined) {
      // 모드만 변경. 모드가 바뀌면 멤버 자동 삭제 (followup 2).
      await this.prisma.$transaction([
        this.prisma.page.update({
          where: { id: pageId },
          data: { restrictionMode: mode },
        }),
        ...(current.restrictionMode !== mode
          ? [this.prisma.pageRestriction.deleteMany({ where: { pageId } })]
          : []),
      ]);
      return { ok: true };
    }

    // Cycle 83 followup 3 — '적용' 흐름: mode + members 원자적 교체.
    // 정규화: NONE 모드는 멤버 비움, EDIT 모드는 role=EDIT 강제, 중복 userId 제거.
    const seen = new Set<string>();
    const normalized: Array<{ userId: string; role: PageRestrictionRole }> = [];
    if (mode !== 'NONE') {
      for (const m of members) {
        if (!m?.userId || seen.has(m.userId)) continue;
        seen.add(m.userId);
        normalized.push({
          userId: m.userId,
          role: mode === 'EDIT' ? 'EDIT' : m.role,
        });
      }
    }
    if (normalized.length > 0) {
      const existing = await this.prisma.user.findMany({
        where: { id: { in: normalized.map((m) => m.userId) } },
        select: { id: true },
      });
      if (existing.length !== normalized.length) {
        throw new BadRequestException({
          error: 'one or more users not found',
        });
      }
    }
    await this.prisma.$transaction([
      this.prisma.page.update({
        where: { id: pageId },
        data: { restrictionMode: mode },
      }),
      this.prisma.pageRestriction.deleteMany({ where: { pageId } }),
      ...(normalized.length > 0
        ? [
            this.prisma.pageRestriction.createMany({
              data: normalized.map((m) => ({
                pageId,
                userId: m.userId,
                role: m.role,
              })),
            }),
          ]
        : []),
    ]);
    return { ok: true };
  }

  async addRestrictionMember(
    pageId: string,
    userId: string,
    role: PageRestrictionRole,
    actor: Actor,
  ) {
    await this.perms.assertCanManagePageRestriction(pageId, actor);
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException({ error: 'user not found' });
    await this.prisma.pageRestriction.upsert({
      where: { pageId_userId: { pageId, userId } },
      update: { role },
      create: { pageId, userId, role },
    });
    return { ok: true };
  }

  async updateRestrictionMember(
    pageId: string,
    userId: string,
    role: PageRestrictionRole,
    actor: Actor,
  ) {
    await this.perms.assertCanManagePageRestriction(pageId, actor);
    const existing = await this.prisma.pageRestriction.findUnique({
      where: { pageId_userId: { pageId, userId } },
      select: { role: true },
    });
    if (!existing) throw new NotFoundException({ error: 'member not found' });
    await this.prisma.pageRestriction.update({
      where: { pageId_userId: { pageId, userId } },
      data: { role },
    });
    return { ok: true };
  }

  async removeRestrictionMember(pageId: string, userId: string, actor: Actor) {
    await this.perms.assertCanManagePageRestriction(pageId, actor);
    await this.prisma.pageRestriction.deleteMany({
      where: { pageId, userId },
    });
    return { ok: true };
  }
}

// Cycle 59 — 발행된 content (ProseMirror JSON) 안에서 mention 노드의 userId
//   추출. content 가 JSON 이 아니면(옛 markdown) 빈 배열 반환 — 자연 skip.
//   중복 제거는 호출 측(NotificationsService.notifyMentions) 이 처리.
export function extractMentionIds(content: string | null | undefined): string[] {
  if (!content) return [];
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('{')) return [];
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return [];
  }
  const ids: string[] = [];
  walkNode(doc, (node) => {
    if (
      typeof node === 'object' &&
      node !== null &&
      (node as { type?: unknown }).type === 'mention'
    ) {
      const attrs = (node as { attrs?: { id?: unknown } }).attrs;
      const id = attrs?.id;
      if (typeof id === 'string' && id) ids.push(id);
    }
  });
  return ids;
}

function walkNode(node: unknown, visit: (n: unknown) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  const content = (node as { content?: unknown[] }).content;
  if (Array.isArray(content)) {
    for (const child of content) walkNode(child, visit);
  }
}
