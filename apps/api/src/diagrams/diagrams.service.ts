import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDiagramDto } from './dto/update-diagram.dto';

@Injectable()
export class DiagramsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const d = await this.prisma.diagram.findUnique({ where: { id } });
    if (!d) throw new NotFoundException({ error: 'not found' });
    return d;
  }

  update(id: string, dto: UpdateDiagramDto) {
    return this.prisma.diagram.update({
      where: { id },
      data: {
        ...(typeof dto.title === 'string' ? { title: dto.title } : {}),
        ...(typeof dto.data === 'string' ? { data: dto.data } : {}),
        ...(typeof dto.preview === 'string' || dto.preview === null
          ? { preview: dto.preview }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.diagram.delete({ where: { id } });
    return { ok: true };
  }
}
