import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Cycle L6 (feature/ldh) — 그룹 생성 입력.
export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
