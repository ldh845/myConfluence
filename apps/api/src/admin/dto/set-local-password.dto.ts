import { IsString, MaxLength } from 'class-validator';

// Cycle L1 (feature/ldh) — 관리자 로컬 비밀번호 설정/초기화
// (PATCH /admin/users/:id/local-password) 입력.
// Cycle L3 — 비밀번호 정책(8자+영문+숫자) 검증은 서비스의 validatePasswordPolicy
//   단일 출처가 담당. DTO 는 타입/상한만 막는다.
export class SetLocalPasswordDto {
  @IsString()
  @MaxLength(200)
  password!: string;
}
