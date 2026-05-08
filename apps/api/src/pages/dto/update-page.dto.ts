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
}
