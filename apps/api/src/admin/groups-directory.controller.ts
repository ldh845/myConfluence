import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupsService } from './groups.service';

// Cycle L7 (feature/ldh) — 그룹 선택용 디렉터리. /admin/groups 와 달리 ADMIN 전용이
//   아니라 인증 사용자 누구나 접근(공간 관리자가 그룹을 공간 권한에 부여할 때 사용).
//   `GET /users`(멘션 디렉터리)와 동일한 성격 — 그룹 이름 목록은 비밀이 아니다.
@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsDirectoryController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list() {
    return this.groups.listBasic();
  }
}
