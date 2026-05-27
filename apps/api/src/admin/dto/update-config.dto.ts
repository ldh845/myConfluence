import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Cycle 48 — PUT /admin/config 부분 갱신. 모든 필드 옵셔널, 검증된 것만 반영.
export class UpdateConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  siteName?: string;

  // 1 MB ~ 10 GB (현실적 상한).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10240)
  uploadLimitMb?: number;

  // 1 분 ~ 1 년(60×24×365=525600).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(525600)
  sessionExpireMin?: number;
}
