import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { CreateDiagramDto } from './dto/create-diagram.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.page.findMany({ orderBy: { createdAt: 'asc' } });
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
      return page;
    });
  }

  listVersions(pageId: string) {
    return this.prisma.pageVersion.findMany({
      where: { pageId },
      orderBy: { version: 'desc' },
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
      return page;
    });
  }

  async remove(id: string) {
    await this.prisma.page.delete({ where: { id } });
    return { ok: true };
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
