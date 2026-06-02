import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateSpaceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  // Cycle 80 — 스페이스 키(선택). 영문/숫자만, 최대 20자. 서버에서 대문자 정규화.
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9]*$/, {
    message: 'key must contain only letters and digits',
  })
  key?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
