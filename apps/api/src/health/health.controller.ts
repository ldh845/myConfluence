import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: string; db: string }> {
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      'SELECT version() AS version',
    );
    const version = rows?.[0]?.version ?? 'unknown';
    return { status: 'ok', db: version };
  }
}
