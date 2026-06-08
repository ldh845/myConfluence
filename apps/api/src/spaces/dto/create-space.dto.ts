import {
  IsBoolean,
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

  // Cycle L10 (feature/ldh) — 공간 생성 기본 정책. 기본 true: 생성자 부서 그룹을
  //   이 공간에 EDITOR 로 자동 부여. false 면 무동작. 생성자 department 없으면 무동작.
  @IsOptional()
  @IsBoolean()
  applyDepartmentDefault?: boolean;

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
