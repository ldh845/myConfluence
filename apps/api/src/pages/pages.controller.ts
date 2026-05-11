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
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { PublishPageDto } from './dto/publish-page.dto';
import { CreateDiagramDto } from './dto/create-diagram.dto';

@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  findAll() {
    return this.pages.findAll();
  }

  @Post()
  create(@Body() dto: CreatePageDto) {
    return this.pages.create(dto);
  }

  // FR-034 (Cycle 11-1) — 내부 링크 modal용 제목 검색.
  // ⚠️ @Get(':id')보다 반드시 위에 선언해야 'search'가 cuid로 매칭되지 않는다.
  @Get('search')
  search(@Query('q') q?: string) {
    return this.pages.search(q ?? '');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pages.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.pages.update(id, dto);
  }

  // 이슈 2 (Cycle 10-1) — 임시 저장. PageVersion 미적재.
  @Patch(':id/draft')
  updateDraft(@Param('id') id: string, @Body() dto: UpdateDraftDto) {
    return this.pages.updateDraft(id, dto);
  }

  // 이슈 2 (Cycle 10-1) — 발행. draft → content + PageVersion 스냅샷.
  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string, @Body() dto: PublishPageDto) {
    return this.pages.publish(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pages.remove(id);
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
