import { IsIn, IsNotEmpty, IsString } from 'class-validator';

// Cycle 74-C — 스페이스 멤버 추가.
export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsIn(['ADMIN', 'EDITOR', 'VIEWER'])
  role!: 'ADMIN' | 'EDITOR' | 'VIEWER';
}
