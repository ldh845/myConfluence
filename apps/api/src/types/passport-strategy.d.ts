// Cycle L-API-1 (feature/ldh) — passport-strategy 의 최소 타입 선언.
// 런타임 패키지는 모노레포 루트 node_modules 에 hoist 되어 resolve 되지만 @types 가
// 없어 tsc 가 declaration 을 못 찾는다. ApiTokenStrategy 가 쓰는 멤버만 선언한다.
declare module 'passport-strategy' {
  import type { Request } from 'express';

  class Strategy {
    name?: string;
    // 전략 진입점. 서브클래스가 override 해 인증을 수행한다.
    authenticate(req: Request, options?: unknown): void;
    // 인증 성공 — req.user 에 채워질 주체.
    success(user: unknown, info?: unknown): void;
    // 인증 실패 — challenge/상태코드. 멀티 전략에서 다음 전략으로 넘어간다.
    fail(challenge?: unknown, status?: number): void;
    fail(status: number): void;
    // 처리 위임(통과). 본 전략에선 사용하지 않음.
    pass(): void;
    // 내부 오류(인증 실패와 구분).
    error(err: unknown): void;
    redirect(url: string, status?: number): void;
  }

  export { Strategy };
}
