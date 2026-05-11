import { IsOptional, IsString } from 'class-validator';

// 이슈 2 (Cycle 10-1) — POST /pages/:id/publish.
// 발행 자체엔 필드가 없고 attribution만 받는다.
export class PublishPageDto {
  @IsOptional()
  @IsString()
  authorName?: string;
}
