import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 53 — '지켜보기' (Watch). SavesService 와 구조 동일하지만 의미가 다름
// (변경 알림 수신자). 향후 알림 발송 사이클에서 watchers 조회로 사용.

@Injectable()
export class WatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async watch(userId: string, pageId: string): Promise<void> {
    await this.prisma.watchList.upsert({
      where: { userId_pageId: { userId, pageId } },
      update: {},
      create: { userId, pageId },
    });
  }

  async unwatch(userId: string, pageId: string): Promise<void> {
    await this.prisma.watchList.deleteMany({
      where: { userId, pageId },
    });
  }

  async isWatching(userId: string, pageId: string): Promise<boolean> {
    const row = await this.prisma.watchList.findUnique({
      where: { userId_pageId: { userId, pageId } },
      select: { userId: true },
    });
    return row !== null;
  }
}
