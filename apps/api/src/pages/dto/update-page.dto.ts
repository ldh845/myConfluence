import { IsOptional, IsString } from 'class-validator';

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  // parentId may be null (move to root) or a string id (re-parent).
  // Undefined means "do not touch".
  @IsOptional()
  @IsString()
  parentId?: string | null;

  // FR-060 — 자동 버전 스냅샷에 attribution을 남기기 위한 필드.
  // page 컬럼으로 forward 하지 않고, 서비스에서 PageVersion에만 기록한다.
  @IsOptional()
  @IsString()
  authorName?: string;
}
