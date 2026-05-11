import { IsOptional, IsString } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  authorName?: string;
}
