import { IsIn } from 'class-validator';

// Cycle 74-C — 스페이스 멤버 역할 변경.
export class UpdateMemberRoleDto {
  @IsIn(['ADMIN', 'EDITOR', 'VIEWER'])
  role!: 'ADMIN' | 'EDITOR' | 'VIEWER';
}
