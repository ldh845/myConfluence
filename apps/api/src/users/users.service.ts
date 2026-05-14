import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 31 — 사용자 목록. SearchOverlay 의 Contributor 필터 드롭다운용.
// passwordHash 는 절대 노출하지 않는다. 'legacy' 시스템 유저는 제외.

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      where: { NOT: { username: 'legacy' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, department: true },
    });
  }
}
