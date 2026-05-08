import { IsOptional, IsString } from 'class-validator';

export class CreateDiagramDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  data?: string;
}
