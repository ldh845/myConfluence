import { IsIn } from 'class-validator';

// Cycle L7 (feature/ldh) — 스페이스 그룹 권한 역할 변경.
export class UpdateMemberGroupRoleDto {
  @IsIn(['ADMIN', 'EDITOR', 'VIEWER'])
  role!: 'ADMIN' | 'EDITOR' | 'VIEWER';
}
