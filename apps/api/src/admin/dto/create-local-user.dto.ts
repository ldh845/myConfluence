import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Cycle L2 (feature/ldh) — 관리자 로컬 계정 생성(POST /admin/users) 입력.
// keycloakId 없이 passwordHash 만 가진 로컬 전용 계정을 발급한다. email 은 선택.
// 비밀번호 복잡도 정책은 L3 — 여기선 최소 길이만 검증(L1 SetLocalPasswordDto 와 동일 기준).
export class CreateLocalUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  department!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(200)
  password!: string;
}
