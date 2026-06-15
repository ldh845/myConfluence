import { IsString, MaxLength, MinLength } from 'class-validator';

// Cycle L1 (feature/ldh) — 로컬 로그인(POST /auth/login) 입력.
// SSO 와 병행하는 하이브리드 인증의 로컬 경로. username/password 만 받는다.
// (Cycle 43 에서 제거됐던 자체 로그인 DTO 를 LOCAL_LOGIN_ENABLED 플래그 하에 재개.)
export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
