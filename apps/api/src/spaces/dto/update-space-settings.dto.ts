import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Cycle 74-B — 공간 도구 '개요' 탭의 스페이스 설정 변경.
//   visibility 는 PUBLIC/PRIVATE 만 (PERSONAL 은 개인 공간 전용이라 여기서 못 바꿈).
//   미지정 필드는 변경하지 않음.
export class UpdateSpaceSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'PRIVATE';

  // Cycle 74-G — 아이콘: 이모지(짧은 문자) 또는 data:image URL(클라 리사이즈). 빈 값=제거.
  @IsOptional()
  @IsString()
  @MaxLength(300000)
  icon?: string | null;
}
