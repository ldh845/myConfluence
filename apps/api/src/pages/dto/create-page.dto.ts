import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePageDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsString()
  @IsNotEmpty()
  spaceId!: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;
}
