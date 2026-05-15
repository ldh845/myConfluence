import { IsOptional, IsString, MaxLength } from 'class-validator';

// 이슈 2 (Cycle 10-1) — POST /pages/:id/publish.
// Cycle 34 — note: "무엇을 변경했나요?" 발행 코멘트(선택). 256자 상한.
// Cycle 36 — content: 편집기의 현재 마크다운(선택). 자동저장(5초 debounce)
// 타이밍에 의존하지 않도록 클라이언트가 직접 발행할 본문을 보낸다. 미지정이면
// 기존 동작(서버의 draftContent 사용)을 따른다.
export class PublishPageDto {
  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  note?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
