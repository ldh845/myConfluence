import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  body!: string;

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

  // FR-001 (Cycle 27d) — authorName은 서버가 JWT의 user.name으로 결정한다.
  // client가 보낸 값은 무시 — DTO에서 제거.
}
