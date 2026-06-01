import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { PageRestrictionMode, PageRestrictionRole } from '@prisma/client';

// Cycle 83 — 페이지 단위 제한 모드/멤버 DTO.

export class UpdatePageRestrictionModeDto {
  @IsEnum(PageRestrictionMode)
  mode!: PageRestrictionMode;
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
