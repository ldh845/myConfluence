import { IsOptional, IsString } from 'class-validator';

// FR-071 (Cycle 16-3a) — 인라인 댓글 resolve. body 없음, authorName(해결자)만.
export class ResolveCommentDto {
  @IsOptional()
  @IsString()
  authorName?: string;
}
