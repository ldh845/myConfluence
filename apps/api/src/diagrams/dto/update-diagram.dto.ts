import { IsOptional, IsString } from 'class-validator';

export class UpdateDiagramDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  data?: string;

  // preview can be a string (URL/data URI) or null (clear it).
  // Service decides what to forward; null is meaningful, so allow it
  // to pass class-validator via @IsOptional.
  @IsOptional()
  @IsString()
  preview?: string | null;
}
