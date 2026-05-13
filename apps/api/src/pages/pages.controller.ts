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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { PublishPageDto } from './dto/publish-page.dto';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { CopyPageDto } from './dto/copy-page.dto';

@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  findAll() {
    return this.pages.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePageDto, @Req() req: Request) {
    return this.pages.create(dto, req.user?.id);
  }

  // FR-090 / FR-092 (Cycle 15-1a) — 전문 검색(제목 + 본문).
  // FR-091 (Cycle 15-3) — 스페이스/날짜 필터 + 정렬.
  // ⚠️ 모든 정적 path는 @Get(':id') 위에 선언.
  @Get('full-search')
  fullSearch(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('spaceId') spaceId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sort') sort?: string,
  ) {
    const parsedSort: 'relevance' | 'newest' | 'updated' =
      sort === 'newest' || sort === 'updated' ? sort : 'relevance';
    const parsedFrom = dateFrom ? new Date(dateFrom) : undefined;
    const parsedTo = dateTo ? new Date(dateTo) : undefined;
    return this.pages.fullSearch(
      q ?? '',
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
      {
        spaceId: spaceId || undefined,
        dateFrom:
          parsedFrom && !isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
        dateTo:
          parsedTo && !isNaN(parsedTo.getTime()) ? parsedTo : undefined,
        sort: parsedSort,
      },
    );
  }

  // FR-034 (Cycle 11-1) — 내부 링크 modal용 제목 검색.
  // ⚠️ @Get(':id')보다 반드시 위에 선언해야 'search'가 cuid로 매칭되지 않는다.
  @Get('search')
  search(@Query('q') q?: string) {
    return this.pages.search(q ?? '');
  }

  // FR-024 (Cycle 18-1a) — 휴지통 목록. 정적 path → :id 위에.
  @Get('trash')
  listTrash() {
    return this.pages.listTrash();
  }

  // FR-130 (Cycle 22) — 홈 화면 최근 수정 페이지.
  @Get('recent')
  recent(@Query('limit') limit?: string) {
    return this.pages.recent(limit ? Number(limit) : 10);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pages.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @Req() req: Request,
  ) {
    return this.pages.update(id, dto, req.user?.id);
  }

  // 이슈 2 (Cycle 10-1) — 임시 저장. PageVersion 미적재.
  @Patch(':id/draft')
  @UseGuards(JwtAuthGuard)
  updateDraft(
    @Param('id') id: string,
    @Body() dto: UpdateDraftDto,
    @Req() req: Request,
  ) {
    return this.pages.updateDraft(id, dto, req.user?.id);
  }

  // 이슈 2 (Cycle 10-1) — 발행. draft → content + PageVersion 스냅샷.
  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  publish(
    @Param('id') id: string,
    @Body() dto: PublishPageDto,
    @Req() req: Request,
  ) {
    return this.pages.publish(id, dto, req.user?.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.pages.remove(
      id,
      req.user ? { id: req.user.id, name: req.user.name } : null,
    );
  }

  // FR-024 (Cycle 18-1a) — 휴지통 복구.
  @Post(':id/restore')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  restore(@Param('id') id: string, @Req() req: Request) {
    return this.pages.restore(
      id,
      req.user ? { id: req.user.id, name: req.user.name } : null,
    );
  }

  // FR-024 (Cycle 18-1a) — 영구 삭제. 휴지통에 있는 페이지만 가능.
  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard)
  permanentDelete(@Param('id') id: string, @Req() req: Request) {
    return this.pages.permanentDelete(
      id,
      req.user ? { id: req.user.id, name: req.user.name } : null,
    );
  }

  // FR-023 (Cycle 18-4a) — 페이지 깊은 복사. recursive=true면 자손 트리까지.
  @Post(':id/copy')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  copy(
    @Param('id') id: string,
    @Body() dto: CopyPageDto,
    @Req() req: Request,
  ) {
    return this.pages.copy(id, dto, req.user?.id);
  }

  @Get(':id/diagrams')
  listDiagrams(@Param('id') id: string) {
    return this.pages.listDiagrams(id);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.pages.listVersions(id);
  }

  @Post(':id/versions/:versionId/restore')
  restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Body() body: { authorName?: string } = {},
  ) {
    return this.pages.restoreVersion(id, versionId, body?.authorName ?? null);
  }

  @Post(':id/diagrams')
  createDiagram(@Param('id') id: string, @Body() dto: CreateDiagramDto) {
    return this.pages.createDiagram(id, dto);
  }
}
