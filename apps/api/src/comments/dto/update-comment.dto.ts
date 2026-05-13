import { IsString } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  body!: string;

  // FR-001 (Cycle 27d) — authorName 변경은 본문 편집에서 다루지 않는다. 제거.
}
