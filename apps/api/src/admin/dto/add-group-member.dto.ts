import { IsString, MinLength } from 'class-validator';

// Cycle L6 (feature/ldh) — 그룹 멤버 추가 입력.
export class AddGroupMemberDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}
