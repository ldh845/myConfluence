import { IsOptional, IsUrl, IsString, IsInt, MaxLength, Min, MinLength } from 'class-validator';

export class CreateAppLauncherItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position = 0;
}

export class UpdateAppLauncherItemsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}