import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

// Cycle 31 — GET /users. 인증 필요. Contributor 필터 후보 목록.
// Cycle 55 — ?q= 검색 필터 추가 (멘션 popup 자동완성).
// Cycle 58 — GET /users/:id 단일 조회 추가 (프로파일 페이지용).
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query('q') q?: string) {
    return this.users.findAll({ q: q || undefined });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }
}
