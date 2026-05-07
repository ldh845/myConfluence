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
          orderBy: { createdAt: 'asc' },
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
