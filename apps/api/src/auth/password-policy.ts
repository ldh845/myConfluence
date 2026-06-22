import { BadRequestException } from '@nestjs/common';

// 비밀번호 정책 단일 출처.
// 계정 생성(POST /admin/users)·관리자 비번 설정(local-password)·셀프 변경
// (PATCH /auth/me/password) 세 경로가 모두 이 함수를 통과한다. DTO 는 길이 상한만
// 막고, 실제 정책(최소 길이)은 여기서 단일하게 검증한다.
//
// 정책: 최소 4자.

export const PASSWORD_MIN_LENGTH = 4;
export const PASSWORD_POLICY_HINT = '4자 이상';

export type PasswordPolicyResult = { ok: boolean; message?: string };

// 순수 함수 — 테스트 용이. 위반 시 사유 메시지를 함께 돌려준다.
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`,
    };
  }
  return { ok: true };
}

// 위반이면 400(BadRequest)로 던지는 가드. 서비스 계층에서 호출.
export function assertPasswordPolicy(password: string): void {
  const result = validatePasswordPolicy(password);
  if (!result.ok) {
    throw new BadRequestException({
      error: 'weak password',
      message: result.message,
    });
  }
}