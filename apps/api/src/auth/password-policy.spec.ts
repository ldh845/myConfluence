import { BadRequestException } from '@nestjs/common';
import {
  assertPasswordPolicy,
  validatePasswordPolicy,
} from './password-policy';

// Cycle L3 (feature/ldh) — 비밀번호 정책 순수 함수 검증.

describe('validatePasswordPolicy', () => {
  it('accepts 8+ chars with letters and digits', () => {
    expect(validatePasswordPolicy('abcd1234')).toEqual({ ok: true });
    expect(validatePasswordPolicy('Pa55word!').ok).toBe(true);
  });

  it('rejects too short (< 8)', () => {
    const r = validatePasswordPolicy('ab12');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('8자');
  });

  it('rejects when no digit', () => {
    const r = validatePasswordPolicy('abcdefgh');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('숫자');
  });

  it('rejects when no letter', () => {
    const r = validatePasswordPolicy('12345678');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('영문');
  });

  it('rejects empty / non-string', () => {
    expect(validatePasswordPolicy('').ok).toBe(false);
    expect(validatePasswordPolicy(undefined as unknown as string).ok).toBe(
      false,
    );
  });
});

describe('assertPasswordPolicy', () => {
  it('does not throw for valid password', () => {
    expect(() => assertPasswordPolicy('abcd1234')).not.toThrow();
  });

  it('throws BadRequestException for invalid password', () => {
    expect(() => assertPasswordPolicy('weak')).toThrow(BadRequestException);
  });
});
