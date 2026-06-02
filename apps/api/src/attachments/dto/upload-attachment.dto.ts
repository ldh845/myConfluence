import { IsOptional, IsString } from 'class-validator';

export class UploadAttachmentDto {
  // FR-080 — 익명 사용자명 attribution. 인증 도입 후 user id로 교체 예정.
  @IsOptional()
  @IsString()
  authorName?: string;
}
