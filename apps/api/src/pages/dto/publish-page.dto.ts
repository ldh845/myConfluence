import { IsOptional, IsString, MaxLength } from 'class-validator';

// 이슈 2 (Cycle 10-1) — POST /pages/:id/publish.
// 발행 자체엔 필드가 없고 attribution만 받는다.
// Cycle 34 — note: "무엇을 변경했나요?" 발행 코멘트(선택). 256자 상한.
export class PublishPageDto {
  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  note?: string;
}
