import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Cycle L2 (feature/ldh) — 관리자 로컬 계정 생성(POST /admin/users) 입력.
// keycloakId 없이 passwordHash 만 가진 로컬 전용 계정을 발급한다. email 은 선택.
// Cycle L3 — 비밀번호 정책(8자+영문+숫자) 검증은 서비스의 validatePasswordPolicy
//   단일 출처가 담당. DTO 는 타입/상한만 막는다(MinLength 제거).
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
  @MaxLength(200)
  password!: string;
}
