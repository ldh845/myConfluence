import { IsString, MaxLength, MinLength } from 'class-validator';

// Cycle L3 (feature/ldh) — 셀프 비밀번호 변경(PATCH /auth/me/password) 입력.
// 정책(8자+영문+숫자) 검증은 서비스의 validatePasswordPolicy 단일 출처가 담당한다.
// DTO 는 타입/상한만 막는다(현재 비번은 길이 정책 무관 — 그냥 비어있지 않게).
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MaxLength(200)
  newPassword!: string;
}
