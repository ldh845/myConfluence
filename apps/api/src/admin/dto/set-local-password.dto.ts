import { IsString, MaxLength, MinLength } from 'class-validator';

// Cycle L1 (feature/ldh) — 관리자 로컬 비밀번호 설정/초기화
// (PATCH /admin/users/:id/local-password) 입력.
// 본격적인 비밀번호 정책(복잡도·만료)은 L3 에서. 여기선 최소 길이만 검증.
export class SetLocalPasswordDto {
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  password!: string;
}
