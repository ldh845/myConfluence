import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiTokenScope } from '@prisma/client';

// Cycle L-API-1 (feature/ldh) — API 토큰 발급 입력(POST /auth/tokens).
//   name: 사람이 식별할 이름(필수). expiresInDays: 없거나 0 이하면 무기한.
// Cycle L-API-3 (feature/ldh) — scope: READ / READ_WRITE. 생략 시 READ_WRITE(기존 동작).
export class CreateApiTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  // 만료(일). 생략/null 이면 무기한. 상한은 10년(과도한 장수명 방지 + 정수 보장).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresInDays?: number;

  // 스코프. 생략 시 서비스가 READ_WRITE 로 기본 적용.
  @IsOptional()
  @IsIn([ApiTokenScope.READ, ApiTokenScope.READ_WRITE])
  scope?: ApiTokenScope;
}
