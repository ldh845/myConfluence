import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';

// Cycle L6 (feature/ldh) — 그룹 관리 라우트. 전역 ADMIN 전용(AdminController 와 동일 가드).
//   GET    /admin/groups                  — 목록(멤버 수 포함)
//   POST   /admin/groups                  — 생성({name, description?}), 중복 409
//   PATCH  /admin/groups/:id              — 수정(KEYCLOAK 403)
//   DELETE /admin/groups/:id              — 삭제(멤버십 cascade, KEYCLOAK 403)
//   GET    /admin/groups/:id/members      — 멤버 목록
//   POST   /admin/groups/:id/members      — 추가({userId}, idempotent, KEYCLOAK 403)
//   DELETE /admin/groups/:id/members/:userId — 제거(KEYCLOAK 403)
@Controller('admin/groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list() {
    return this.groups.list();
  }

  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groups.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groups.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.groups.remove(id);
  }

  @Get(':id/members')
  listMembers(@Param('id') id: string) {
    return this.groups.listMembers(id);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddGroupMemberDto) {
    return this.groups.addMember(id, dto.userId);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.groups.removeMember(id, userId);
  }
}
