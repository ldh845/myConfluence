import { IsOptional, IsString } from 'class-validator';

// 이슈 2 (Cycle 10-1) — PATCH /pages/:id/draft.
// content는 매번 통째 교체 (덮어쓰기). 누적 이력은 publish 시점에
// PageVersion으로 적재된다.
export class UpdateDraftDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  authorName?: string;
}
