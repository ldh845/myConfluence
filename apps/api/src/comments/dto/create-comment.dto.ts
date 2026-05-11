import { IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
