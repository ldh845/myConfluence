import { IsIn, IsNotEmpty, IsString } from 'class-validator';

// Cycle L7 (feature/ldh) — 스페이스에 그룹 권한 부여.
export class AddMemberGroupDto {
  @IsString()
  @IsNotEmpty()
  groupId!: string;

  @IsIn(['ADMIN', 'EDITOR', 'VIEWER'])
  role!: 'ADMIN' | 'EDITOR' | 'VIEWER';
}
