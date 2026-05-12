import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  // FR-071 (Cycle 16-3a) — 인라인 댓글 토글 + 앵커.
  @IsOptional()
  @IsBoolean()
  isInline?: boolean;

  @IsOptional()
  @IsString()
  anchorJson?: string;
}
