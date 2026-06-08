import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PageStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { PagesService } from './pages.service';
import { SpacePermissionService } from '../spaces/space-permission.service';
import { EffectiveAccessService } from '../spaces/effective-access.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { PublishPageDto } from './dto/publish-page.dto';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { CopyPageDto } from './dto/copy-page.dto';
import { UpdatePageStatusDto } from './dto/update-page-status.dto';
import {
  AddPageRestrictionMemberDto,
  UpdatePageRestrictionMemberDto,
  UpdatePageRestrictionModeDto,
} from './dto/update-page-restriction.dto';

// FR-001 (Cycle 27e) — actor 헬퍼 통일. 모든 mutation이 같은 형태로 전달.
function actorFromReq(req: Request): { id: string; name: string } | null {
  return req.user ? { id: req.user.id, name: req.user.name } : null;
}

// Cycle 70/74-A — role 까지 포함한 actor. 권한 판정(SpacePermissionService)에 사용.
function userFromReq(
  req: Request,
): { id: string; name: string; role: string } | null {
  return req.user
    ? { id: req.user.id, name: req.user.name, role: req.user.role }
    : null;
}

// Cycle 71 — ?status= 콤마 목록을 유효 토큰만 추려 파싱. 빈 결과면 undefined.
//   NONE = 상태 없음(null). 그 외는 PageStatus enum 값.
function parseStatuses(raw?: string): Array<PageStatus | 'NONE'> | undefined {
  if (!raw) return undefined;
  const valid = new Set(['TODO', 'IN_PROGRESS', 'DONE', 'DROP', 'NONE']);
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => valid.has(s)) as Array<PageStatus | 'NONE'>;
  return list.length ? list : undefined;
}

@Controller('pages')
export class PagesController {
  constructor(
    private readonly pages: PagesService,
    // Cycle 74-A — 스페이스 권한 판정(읽기/쓰기 가드).
    private readonly perms: SpacePermissionService,
    // Cycle L9 — 페이지 접근 권한 역산.
    private readonly effectiveAccess: EffectiveAccessService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@Req() req: Request) {
    return this.pages.findAll(userFromReq(req));
  }

  // Cycle L9 (feature/ldh) — 접근 권한 역산: 이 페이지를 볼 수 있는 사용자 전부와 경로.
  //   NONE → 공간 결과와 동일, EDIT/VIEW_EDIT → 제한 통과자로 좁힘(L7-2 그룹 포함).
  //   조회 권한은 공간 canManage(또는 전역 ADMIN) — service 가 게이트.
  @Get(':id/effective-access')
  @UseGuards(JwtAuthGuard)
  effectiveAccessForPage(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.effectiveAccess.pageEffectiveAccess(id, userFromReq(req), {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreatePageDto, @Req() req: Request) {
    // Cycle 74-A — 대상 스페이스 편집 권한 확인.
    await this.perms.assertCanEdit(dto.spaceId, userFromReq(req));
    return this.pages.create(dto, actorFromReq(req));
  }

  // FR-090 / FR-092 (Cycle 15-1a) — 전문 검색(제목 + 본문).
  // FR-091 (Cycle 15-3) — 스페이스/날짜 필터 + 정렬.
  // ⚠️ 모든 정적 path는 @Get(':id') 위에 선언.
  @Get('full-search')
  @UseGuards(OptionalJwtAuthGuard)
  fullSearch(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    // Cycle 31 — 다중 필터. spaceId/authorId(단수)는 하위호환으로 흡수.
    @Query('spaceId') spaceId?: string,
    @Query('spaceIds') spaceIds?: string,
    @Query('authorId') authorId?: string,
    @Query('authorIds') authorIds?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sort') sort?: string,
  ) {
    const parsedSort: 'relevance' | 'newest' | 'updated' =
      sort === 'newest' || sort === 'updated' ? sort : 'relevance';
    const parsedFrom = dateFrom ? new Date(dateFrom) : undefined;
    const parsedTo = dateTo ? new Date(dateTo) : undefined;
    // 콤마 구분 목록 + 하위호환 단수 파라미터를 하나로 병합.
    const spaceIdList = [
      ...(spaceId ? [spaceId] : []),
      ...(spaceIds ? spaceIds.split(',').filter(Boolean) : []),
    ];
    const authorIdList = [
      ...(authorId ? [authorId] : []),
      ...(authorIds ? authorIds.split(',').filter(Boolean) : []),
    ];
    return this.pages.fullSearch(
      q ?? '',
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
      {
        spaceIds: spaceIdList.length ? spaceIdList : undefined,
        authorIds: authorIdList.length ? authorIdList : undefined,
        dateFrom:
          parsedFrom && !isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
        dateTo:
          parsedTo && !isNaN(parsedTo.getTime()) ? parsedTo : undefined,
        sort: parsedSort,
      },
      // Cycle 74-A — 가시성 필터.
      userFromReq(req),
    );
  }

  // FR-034 (Cycle 11-1) — 내부 링크 modal용 제목 검색.
  // ⚠️ @Get(':id')보다 반드시 위에 선언해야 'search'가 cuid로 매칭되지 않는다.
  @Get('search')
  @UseGuards(OptionalJwtAuthGuard)
  search(@Req() req: Request, @Query('q') q?: string) {
    return this.pages.search(q ?? '', 10, userFromReq(req));
  }

  // FR-024 (Cycle 18-1a) — 휴지통 목록. 정적 path → :id 위에.
  // Cycle L5 — 인증 필수 + 가시성 필터(접근 불가 스페이스의 삭제 페이지 누수 차단).
  @Get('trash')
  @UseGuards(JwtAuthGuard)
  listTrash(@Req() req: Request) {
    return this.pages.listTrash(userFromReq(req));
  }

  // FR-130 (Cycle 22) — 홈 화면 최근 수정 페이지.
  // Cycle 51 — spaceId(옵셔널) + offset(옵셔널) 추가. 미지정 시 기존 동작 그대로.
  //   /?spaceId=X&view=pages 의 SpacePagesView 가 spaceId+offset 으로 호출.
  @Get('recent')
  @UseGuards(OptionalJwtAuthGuard)
  recent(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('spaceId') spaceId?: string,
    @Query('offset') offset?: string,
    // Cycle 71 — 상태 필터(콤마 구분). 값: TODO,IN_PROGRESS,DONE,NONE(상태 없음).
    @Query('status') status?: string,
  ) {
    return this.pages.recent({
      limit: limit ? Number(limit) : 10,
      spaceId: spaceId || undefined,
      offset: offset ? Number(offset) : 0,
      statuses: parseStatuses(status),
      // Cycle 74-A — 가시성 필터.
      actor: userFromReq(req),
    });
  }

  // Cycle 71 — 칸반 보드: 공간 전체 발행 페이지(상태 그룹핑은 FE). :id 위에 선언.
  // Cycle 73 — ?userId= 콤마 목록(작성자/마지막 편집자 OR 필터).
  // Cycle 74-A — 해당 스페이스 view 권한 확인(PRIVATE 비멤버 차단).
  @Get('board')
  @UseGuards(OptionalJwtAuthGuard)
  async board(
    @Req() req: Request,
    @Query('spaceId') spaceId?: string,
    @Query('userId') userId?: string,
  ) {
    if (spaceId) await this.perms.assertCanView(spaceId, userFromReq(req));
    const userIds = userId
      ? userId.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    return this.pages.boardPages(spaceId || '', userIds);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.pages.findOne(id, userFromReq(req));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @Req() req: Request,
  ) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.pages.update(id, dto, actorFromReq(req));
  }

  // Cycle 70 — 페이지 작업 상태 변경. 가드(작성자/ADMIN 임시)는 service 에서 — 그대로 유지.
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  changeStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePageStatusDto,
    @Req() req: Request,
  ) {
    return this.pages.changeStatus(id, dto.status, userFromReq(req));
  }

  // ─── Cycle 83 — 페이지 단위 제한 ──────────────────────────────────────────
  @Get(':id/restriction')
  @UseGuards(JwtAuthGuard)
  getRestriction(@Param('id') id: string, @Req() req: Request) {
    return this.pages.getRestriction(id, userFromReq(req));
  }

  @Patch(':id/restriction')
  @UseGuards(JwtAuthGuard)
  updateRestrictionMode(
    @Param('id') id: string,
    @Body() dto: UpdatePageRestrictionModeDto,
    @Req() req: Request,
  ) {
    return this.pages.updateRestrictionMode(
      id,
      dto.mode,
      userFromReq(req),
      dto.members,
      dto.groups,
    );
  }

  @Post(':id/restriction/members')
  @UseGuards(JwtAuthGuard)
  addRestrictionMember(
    @Param('id') id: string,
    @Body() dto: AddPageRestrictionMemberDto,
    @Req() req: Request,
  ) {
    return this.pages.addRestrictionMember(
      id,
      dto.userId,
      dto.role,
      userFromReq(req),
    );
  }

  @Patch(':id/restriction/members/:userId')
  @UseGuards(JwtAuthGuard)
  updateRestrictionMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdatePageRestrictionMemberDto,
    @Req() req: Request,
  ) {
    return this.pages.updateRestrictionMember(
      id,
      userId,
      dto.role,
      userFromReq(req),
    );
  }

  @Delete(':id/restriction/members/:userId')
  @UseGuards(JwtAuthGuard)
  removeRestrictionMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.pages.removeRestrictionMember(id, userId, userFromReq(req));
  }

  // 이슈 2 (Cycle 10-1) — 임시 저장. PageVersion 미적재.
  @Patch(':id/draft')
  @UseGuards(JwtAuthGuard)
  async updateDraft(
    @Param('id') id: string,
    @Body() dto: UpdateDraftDto,
    @Req() req: Request,
  ) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.pages.updateDraft(id, dto, actorFromReq(req));
  }

  // 이슈 2 (Cycle 10-1) — 발행. draft → content + PageVersion 스냅샷.
  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async publish(
    @Param('id') id: string,
    @Body() dto: PublishPageDto,
    @Req() req: Request,
  ) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.pages.publish(id, dto, actorFromReq(req));
  }

  // Cycle 56 — ?cascade=true 면 자손 모두 휴지통, 그 외(기본)는 직접 자식 승격
  // 후 부모만 휴지통. 사용자 의도("딱 페이지만") 가 기본.
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string,
    @Query('cascade') cascade: string | undefined,
    @Req() req: Request,
  ) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.pages.remove(
      id,
      { cascade: cascade === 'true' },
      actorFromReq(req),
    );
  }

  // FR-024 (Cycle 18-1a) — 휴지통 복구.
  @Post(':id/restore')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async restore(@Param('id') id: string, @Req() req: Request) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.pages.restore(id, actorFromReq(req));
  }

  // FR-024 (Cycle 18-1a) — 영구 삭제. 휴지통에 있는 페이지만 가능.
  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard)
  async permanentDelete(@Param('id') id: string, @Req() req: Request) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.pages.permanentDelete(id, actorFromReq(req));
  }

  // FR-023 (Cycle 18-4a) — 페이지 깊은 복사. recursive=true면 자손 트리까지.
  @Post(':id/copy')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async copy(
    @Param('id') id: string,
    @Body() dto: CopyPageDto,
    @Req() req: Request,
  ) {
    // 원본 편집 권한 확인. (대상 스페이스 전환 시 추가 검증은 향후 sub-cycle.)
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.pages.copy(id, dto, actorFromReq(req));
  }

  // Cycle L5 — 무가드였던 다이어그램/버전 목록에 읽기 권한 가드 추가.
  //   비공개/개인 공간·VIEW_EDIT 제한 페이지의 다이어그램/편집 이력 누수 차단.
  //   PUBLIC 은 그대로 통과(OptionalJwt — 공개 흐름 무변화).
  @Get(':id/diagrams')
  @UseGuards(OptionalJwtAuthGuard)
  async listDiagrams(@Param('id') id: string, @Req() req: Request) {
    await this.perms.assertCanViewPage(id, userFromReq(req));
    return this.pages.listDiagrams(id);
  }

  @Get(':id/versions')
  @UseGuards(OptionalJwtAuthGuard)
  async listVersions(@Param('id') id: string, @Req() req: Request) {
    await this.perms.assertCanViewPage(id, userFromReq(req));
    return this.pages.listVersions(id);
  }

  // Cycle 74-A — 기존 무가드였던 버전 복원에 JwtAuthGuard + 편집 권한 가드 추가.
  @Post(':id/versions/:versionId/restore')
  @UseGuards(JwtAuthGuard)
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Req() req: Request,
    @Body() body: { authorName?: string } = {},
  ) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.pages.restoreVersion(id, versionId, body?.authorName ?? null);
  }

  // Cycle 74-A — 기존 무가드였던 다이어그램 생성에 JwtAuthGuard + 편집 권한 가드 추가.
  @Post(':id/diagrams')
  @UseGuards(JwtAuthGuard)
  async createDiagram(
    @Param('id') id: string,
    @Body() dto: CreateDiagramDto,
    @Req() req: Request,
  ) {
    await this.perms.assertCanEditPage(id, userFromReq(req));
    return this.pages.createDiagram(id, dto);
  }
}
