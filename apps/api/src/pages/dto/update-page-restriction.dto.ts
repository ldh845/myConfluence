import { IsArray, IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { PageRestrictionMode, PageRestrictionRole } from '@prisma/client';

// Cycle 83 — 페이지 단위 제한 모드/멤버 DTO.

// Cycle 83 followup 3 — '적용' 흐름. mode 와 members 를 함께 보내면 원자적 교체.
//   members 미지정이면 모드만 변경(모드 바뀌면 멤버 자동 삭제 — followup 2).
export class UpdatePageRestrictionModeDto {
  @IsEnum(PageRestrictionMode)
  mode!: PageRestrictionMode;

  @IsOptional()
  @IsArray()
  members?: Array<{ userId: string; role: PageRestrictionRole }>;

  // Cycle L7-2 (feature/ldh) — 제한 멤버에 그룹 추가. members 와 함께 원자적 교체.
  @IsOptional()
  @IsArray()
  groups?: Array<{ groupId: string; role: PageRestrictionRole }>;
}

export class AddPageRestrictionMemberDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEnum(PageRestrictionRole)
  role!: PageRestrictionRole;
}

export class UpdatePageRestrictionMemberDto {
  @IsEnum(PageRestrictionRole)
  role!: PageRestrictionRole;
}
