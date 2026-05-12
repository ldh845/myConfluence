import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

// FR-023 (Cycle 18-4a) — 페이지 깊은 복사.
// 모든 필드 optional. recursive=false면 단일 페이지만 새 row + 첨부/다이어그램.
// recursive=true면 자손까지 트리 복제 (parentId 매핑 자동).
export class CopyPageDto {
  @IsOptional()
  @IsString()
  targetSpaceId?: string;

  @IsOptional()
  @IsString()
  targetParentId?: string | null;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  recursive?: boolean;
}
