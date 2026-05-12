import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';

@Injectable()
export class SpacesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.space.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        pages: {
          // FR-024 (Cycle 18-1a) — 휴지통 페이지는 사이드바에서 제외.
          where: { deletedAt: null },
          // FR-021 (Cycle 19a) — 사이드바 트리 정렬용 position 우선.
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            parentId: true,
            spaceId: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  create(dto: CreateSpaceDto) {
    return this.prisma.space.create({
      data: { name: dto.name, description: dto.description ?? null },
    });
  }
}
