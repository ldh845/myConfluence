import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Cycle L6 (feature/ldh) — 그룹 수정 입력(부분). 둘 다 옵션.
export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
