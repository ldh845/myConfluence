import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Cycle 74-F — 사이드바 바로가기 DTO.
export class AddShortcutDto {
  @IsIn(['INTERNAL_PAGE', 'EXTERNAL_URL'])
  type!: 'INTERNAL_PAGE' | 'EXTERNAL_URL';

  @IsString()
  @MaxLength(100)
  label!: string;

  // INTERNAL_PAGE=pageId, EXTERNAL_URL=URL(http/https — service 에서 스킴 검증).
  @IsString()
  @MaxLength(2000)
  target!: string;
}

export class UpdateShortcutDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  target?: string;
}

export class ReorderShortcutsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
